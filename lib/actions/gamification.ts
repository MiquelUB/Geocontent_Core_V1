'use server';


import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";
import { getUserProfile } from '@/lib/actions/auth';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { getPassportData as _getPassportData, getUserScore as _getUserScore } from '../services/queries';
import { requireAuth } from '@/lib/auth-guard';

import { rateLimit } from '@/lib/services/ratelimit';

// --- SERVER ACTION WRAPPERS (Cervell -> Múscul) ---
export async function getPassportData(userId: string) {
    return _getPassportData(userId);
}

export async function getUserScore(userId: string) {
    return _getUserScore(userId);
}

async function updateProfileXpAndLevel(userId: string, points: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true }
  });

  if (user) {
    const newXp = (user.xp || 0) + points;
    // Lògica simple de nivell: cada 500 XP un nivell
    const newLevel = Math.floor(newXp / 500) + 1;

    await prisma.user.update({
      where: { id: userId },
      data: { xp: newXp, level: newLevel }
    });
  }
}

/**
 * Registra una visita a un POI.
 * SEC-03: userId derivat de la sessió Auth.js, mai del client.
 * El paràmetre _clientUserId s'ignora (backward compatibility).
 */
export async function recordVisit(_clientUserId: string, poiId: string) {
  try {
    // SEC-03: El userId REAL prové de la sessió, no del client
    const userId = await requireAuth();

    // Verify user exists in DB (fixes P2003 error if DB was reset but JWT cookie remains)
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) {
        return { success: false, error: "Usuari no trobat. Si us plau, torna a iniciar sessió." };
    }

    const poi = await prisma.poi.findUnique({ where: { id: poiId } });
    if (!poi) return { success: false, error: "POI not found" };

    const existing = await prisma.userUnlock.findUnique({
      where: { userId_poiId: { userId, poiId } }
    });

    if (existing) return { success: true, message: 'Already visited' };

    // Premi: 100 XP per desbloquejar POI
    const points = 100;

    await prisma.userUnlock.create({
      data: {
        userId,
        poiId,
        unlockedAt: new Date(),
        earnedXp: points,
        quizSolved: false
      }
    });

    // Actualitzem perfil
    await updateProfileXpAndLevel(userId, points);

    const updatedUser = await getUserProfile(userId);
    
    // CHECK ROUTE COMPLETION
    const routePois = await prisma.routePoi.findMany({
      where: { poiId: poiId },
      select: { routeId: true }
    });

    for (const rp of routePois) {
      await checkAndAwardRouteCompletion(userId, rp.routeId);
    }

    return { success: true, user: updatedUser };
  } catch (err: any) {
    if (err.message === 'No autenticat. Sessió requerida.') {
      return { success: false, error: 'No autenticat.' };
    }
    console.error('[recordVisit error]', err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

async function checkAndAwardRouteCompletion(userId: string, routeId: string) {
  try {
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: { routePois: true }
    });
    if (!route) return;

    const totalPois = route.routePois.length;
    const unlockedPois = await prisma.userUnlock.count({
      where: {
        userId,
        poiId: { in: route.routePois.map(rp => rp.poiId) }
      }
    });

    if (totalPois > 0 && unlockedPois === totalPois) {
      const existingProgress = await prisma.userRouteProgress.findUnique({
        where: { userId_routeId: { userId, routeId } }
      });

      if (!existingProgress) {
        // Premi: 500 XP per completar ruta
        await prisma.userRouteProgress.create({
          data: {
            userId,
            routeId,
            completedAt: new Date()
          }
        });

        await updateProfileXpAndLevel(userId, 500);
      }
    }
  } catch (e) {
    console.error("Error checking route completion:", e);
  }
}

export async function getVisitedLegends(userId: string) {
  noStore();
  // El model 'visited_legends' era una vista o taula llegada.
  // En el nou esquema, busquem Unlocks de POIs tipus 'LLEGENDA'
  try {
    const unlocks = await prisma.userUnlock.findMany({
      where: { 
        userId,
        poi: { type: 'LLEGENDA' }
      },
      include: { poi: true },
      orderBy: { unlockedAt: 'desc' }
    });

    return unlocks.map(u => ({
      ...u.poi,
      visited_at: u.unlockedAt
    }));
  } catch (err) {
    console.error('Error fetching visited legends:', err);
    return [];
  }
}

export async function getUserVisits(userId: string) {
  try {
    const visits = await prisma.userUnlock.findMany({
      where: { userId },
      include: {
        poi: {
          select: { title: true }
        }
      },
      orderBy: { unlockedAt: 'desc' }
    });

    return visits.map(v => ({
      id: `${v.userId}-${v.poiId}`,
      poi: v.poi,
      entryTime: v.unlockedAt.toISOString(),
      durationSeconds: null, 
      rating: v.quizSolved ? 5 : null 
    }));
  } catch (error) {
    console.error('Error fetching user visits:', error);
    return [];
  }
}

/**
 * Completa un quiz de POI.
 * SEC-03: userId derivat de la sessió Auth.js.
 * El paràmetre _clientUserId s'ignora (backward compatibility).
 */
export async function completePoiQuizAction(poiId: string, _clientUserId: string, attempts: number = 1) {
  try {
    // SEC-03: El userId REAL prové de la sessió
    const userId = await requireAuth();

    // SEC-10: Rate Limiting obligatori per a mutacions sensibles (evitar força bruta en respostes)
    const rl = await rateLimit(`quiz:${userId}:${poiId}`, 10, 60); // Max 10 intents per minut per POI
    if (!rl.success) {
      return { success: false, error: 'Massa intents de resolució. Espera 1 minut.' };
    }
    
    // Scale points based on attempts: 1st=50, 2nd=40, 3rd=30, 4+=20
    const points = Math.max(20, 50 - ((attempts - 1) * 10));

    const unlock = await prisma.userUnlock.findUnique({
      where: { userId_poiId: { userId, poiId } },
      select: { quizSolved: true }
    });

    if (unlock?.quizSolved) return { success: true, message: 'Quiz already solved' };

    await prisma.userUnlock.update({
      where: { userId_poiId: { userId, poiId } },
      data: {
        quizSolved: true,
        earnedXp: { increment: points }
      }
    });

    await updateProfileXpAndLevel(userId, points);

    const updatedUser = await getUserProfile(userId);
    revalidatePath('/profile');
    return { success: true, user: updatedUser };
  } catch (err: any) {
    if (err.message === 'No autenticat. Sessió requerida.') {
      return { success: false, error: 'No autenticat.' };
    }
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

/**
 * Completa el quiz final d'una ruta.
 * SEC-03: userId derivat de la sessió Auth.js.
 * El paràmetre _clientUserId s'ignora (backward compatibility).
 */
export async function completeFinalRouteQuizAction(routeId: string, _clientUserId: string) {
  try {
    // SEC-03: El userId REAL prové de la sessió
    const userId = await requireAuth();
    const points = 1000;

    await prisma.userRouteProgress.upsert({
      where: { userId_routeId: { userId, routeId } },
      create: {
        userId,
        routeId,
        completedAt: new Date()
      },
      update: {
        completedAt: new Date()
      }
    });

    await updateProfileXpAndLevel(userId, points);
    revalidatePath('/profile');
    return { success: true };
  } catch (err: any) {
    if (err.message === 'No autenticat. Sessió requerida.') {
      return { success: false, error: 'No autenticat.' };
    }
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

/**
 * Permet a l'usuari valorar una ruta completada (afegir estrelles i comentari).
 */
export async function rateRouteAction(userId: string, routeId: string, rating: number, comment: string) {
  try {
    if (!userId || !routeId) {
      return { success: false, error: "Dades incompletes." };
    }

    const cleanRating = Math.min(Math.max(rating, 0), 5);

    const progress = await prisma.userRouteProgress.upsert({
      where: {
        userId_routeId: { userId, routeId }
      },
      update: {
        rating: cleanRating,
        comment: comment || ""
      },
      create: {
        userId,
        routeId,
        rating: cleanRating,
        comment: comment || "",
        completedAt: new Date()
      }
    });
    revalidatePath('/profile');
    return { success: true, progress };
  } catch (err: any) {
    console.error('[rateRouteAction error]', err);
    return { success: false, error: "Error desant la valoració." };
  }
}

/**
 * Obté el progrés (incloent valoració i comentari) d'una ruta per a un usuari.
 */
export async function getUserRouteProgressAction(userId: string, routeId: string) {
  try {
    if (!userId || !routeId) {
      return { success: false, error: "Dades incompletes." };
    }

    const progress = await prisma.userRouteProgress.findUnique({
      where: {
        userId_routeId: { userId, routeId }
      }
    });

    return { success: true, progress };
  } catch (err: any) {
    console.error('[getUserRouteProgressAction error]', err);
    return { success: false, error: "Error en carregar el progrés." };
  }
}

/**
 * Obté les valoracions i comentaris escrits de les rutes per a un usuari concret.
 */
export async function getUserRouteReviews(userId: string) {
  try {
    if (!userId) return [];

    const reviews = await prisma.userRouteProgress.findMany({
      where: { userId },
      include: {
        route: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reviews.map(r => ({
      id: r.id,
      routeName: r.route?.name || 'Ruta',
      rating: r.rating || 0,
      comment: r.comment || '',
      completedAt: r.completedAt ? r.completedAt.toISOString() : r.createdAt.toISOString()
    }));
  } catch (error) {
    console.error('Error fetching user route reviews:', error);
    return [];
  }
}


import { prisma } from '@/lib/database/prisma';

/**
 * Obté el perfil de l'usuari des de la base de dades local (Easypanel)
 * Motor d'autenticació sobirà.
 */
export async function getUserProfileInternal(userId: string) {
  if (!userId) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { unlocks: true }
        }
      }
    });

    if (!user) return null;

    return {
      ...user,
      visitedCount: user._count.unlocks || 0,
      username: user.username || "Explorador",
      avatarUrl: user.avatarUrl,
      xp: user.xp || 0
    };
  } catch (err) {
    console.error('[getUserProfileInternal error]', err);
    return null;
  }
}

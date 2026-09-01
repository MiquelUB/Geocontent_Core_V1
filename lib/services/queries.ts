import 'server-only';
import { prisma } from "../database/prisma";
import { withRLS } from "../database/prisma-rls";
import { unstable_noStore as noStore } from 'next/cache';

export async function getAppBranding() {
  noStore();
  try {
    const m = await prisma.municipality.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        themeId: true,
      }
    });
    return m;
  } catch (e) {
    // Graceful fallback during build-time static generation when DB is not reachable
    return null;
  }
}

export async function getMunicipalities() {
  noStore();
  try {
    return await prisma.municipality.findMany({
      select: {
        id: true,
        name: true,
        themeId: true,
      },
      orderBy: { name: 'asc' }
    });
  } catch (err) {
    console.error('Error fetching municipalities:', err);
    return [];
  }
}

export async function getAdminLegends() {
  noStore();
  try {
    const routes = await prisma.route.findMany({
      include: {
        municipality: { select: { name: true } },
        routePois: {
          include: {
            poi: {
              include: {
                _count: {
                  select: { userUnlocks: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const legends = routes.map((route: any) => ({
      id: route.id,
      name: route.name,
      title: route.name, // UI compat
      description: route.description || '',
      nameTranslations: route.nameTranslations || {},
      descriptionTranslations: route.descriptionTranslations || {},
      audioTranslations: route.audioTranslations || {},
      category: route.themeId || 'mountain',
      location_name: (route.municipality?.name || '').replace(/^Ajuntament de /i, ''),
      municipality_name: route.municipality?.name || 'Sense municipi',
      thumbnail_1x1: route.thumbnail1x1 || '',
      header_16x9: route.header16x9 || '',
      pois_count: route.routePois?.length || 0,
      total_visits: route.routePois?.reduce((acc: number, rp: any) => acc + (rp.poi?._count?.userUnlocks || 0), 0) || 0,
      created_at: route.createdAt
    }));

    return legends;
  } catch (err) {
    console.error(" [Error in getAdminLegends]:", err);
    return [];
  }
}

export async function getRouteWithPois(routeId: string) {
  noStore();
  try {
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        routePois: {
          orderBy: { orderIndex: 'asc' },
          include: {
            poi: true
          }
        }
      }
    });
    return route;
  } catch (err) {
    console.error(" [Error in getRouteWithPois]:", err);
    return null;
  }
}

export async function getAllProfiles() {
  noStore();
  try {
    const rawUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        role: true,
        level: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Deduplicar en memòria per email normalitzat
    const seenEmails = new Set<string>();
    const uniqueUsers = [];

    for (const u of rawUsers) {
      const cleanEmail = (u.email || '').toLowerCase().trim();
      if (!cleanEmail) {
        uniqueUsers.push(u);
        continue;
      }
      if (!seenEmails.has(cleanEmail)) {
        seenEmails.add(cleanEmail);
        uniqueUsers.push({
          ...u,
          email: cleanEmail
        });
      }
    }

    return uniqueUsers;
  } catch (err) {
    console.error(" [Error in getAllProfiles]:", err);
    return [];
  }
}

export async function getLegends(userId?: string) {
  try {
    const routes = await prisma.route.findMany({
      include: {
        municipality: { select: { name: true } },
        routePois: {
          include: {
            poi: {
              omit: { voiceScript: true },
              include: { 
                userUnlocks: userId ? { where: { userId } } : false 
              }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    return routes.map(r => mapRoute(r));
  } catch (err: any) {
    console.error(" [Error in getLegends]:", err);
    return [];
  }
}

function mapRoute(route: any) {
  const pois = route.routePois?.map((rp: any) => {
    const p = rp.poi;
    // En el nou model, lat/lng venen de location (geometry) o camps virtuals
    const lat = p.latitude ?? 0;
    const lng = p.longitude ?? 0;

    return {
      ...p,
      id: p.id,
      title: p.title,
      description: p.description || '',
      titleTranslations: p.titleTranslations || {},
      descriptionTranslations: p.descriptionTranslations || {},
      textContentTranslations: p.textContentTranslations || {},
      latitude: lat,
      longitude: lng,
      image_url: p.appThumbnail || p.carouselImages?.[0] || '',
      orderIndex: rp.orderIndex ?? 0,
      icon: p.icon || null,
      textContent: p.textContent || '',
      audioUrl: p.audioUrl || '',
      videoUrls: p.videoUrls || [],
      carouselImages: p.carouselImages || [],
      header16x9: p.header16x9 || '',
      appThumbnail: p.appThumbnail || '',
      manualQuiz: p.manualQuiz,
      type: p.type,
      userUnlocks: p.userUnlocks || [],
      audioTranslations: p.audioTranslations || {},
      videoTranslations: p.videoTranslations || {},
      routeId: route.id,
      // No enviem `voiceScript` al client perquè pesa massa i fa petar el Next.js
    };
  }) ?? [];

  const firstPoi = pois[0];
  const muniName = (route.municipality?.name || '').replace(/^Ajuntament de /i, '');
  const title = route.name || route.slug || 'Ruta';

  return {
    id: route.id,
    name: title,
    title: title,
    description: route.description || '',
    nameTranslations: route.nameTranslations || {},
    titleTranslations: route.nameTranslations || {},
    descriptionTranslations: route.descriptionTranslations || {},
    audioTranslations: route.audioTranslations || {},
    category: route.themeId || '',
    location_name: muniName || '',
    latitude: firstPoi?.latitude ?? 0,
    longitude: firstPoi?.longitude ?? 0,
    image_url: route.thumbnail1x1 || firstPoi?.appThumbnail || '',
    hero_image_url: route.header16x9 || firstPoi?.header16x9 || route.thumbnail1x1 || '',
    poiCount: pois.length,
    pois,
    finalQuiz: route.finalQuiz || null,
  };
}

export async function getDefaultMunicipalityId(): Promise<string | null> {
  try {
    const municipality = await prisma.municipality.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    return municipality?.id ?? null;
  } catch {
    return null;
  }
}

export async function getDefaultMunicipalityTheme(): Promise<string> {
  try {
    const municipality = await prisma.municipality.findFirst({ select: { themeId: true } });
    return (municipality as any)?.themeId || 'mountain';
  } catch {
    return 'mountain';
  }
}

export async function getUserScore(userId: string) {
  noStore();
  try {
    const rls = withRLS(userId);
    const unlocks = await rls.userUnlock.findMany({
      where: { userId },
      select: { earnedXp: true, quizSolved: true }
    });

    const routeProgress = await rls.userRouteProgress.findMany({
      where: { userId }
    });

    const totalScore = unlocks.reduce((acc, curr) => acc + (curr.earnedXp || 0), 0) + (routeProgress.length * 500);
    const solvedQuizzesCount = unlocks.filter(u => u.quizSolved).length;

    return {
      totalScore,
      solvedQuizzesCount,
      visitedCount: unlocks.length
    };
  } catch (err) {
    console.error('[getUserScore error]', err);
    return { totalScore: 0, solvedQuizzesCount: 0, visitedCount: 0 };
  }
}

export async function getPassportData(userId: string) {
  noStore();
  if (!userId) return [];

  // Dinàmic per evitar problemes en build de client-side si es cridés per error
  const path = await import('path');
  const fs = await import('fs');

  try {
    const rls = withRLS(userId);
    const municipality = await rls.municipality.findFirst({
      select: { themeId: true }
    });
    const municipalityBiome = (municipality as any)?.themeId || 'mountain';

    const biomePathMap: Record<string, string> = {
      mountain: 'Montanya',
      coast: 'Mar',
      city: 'City',
      interior: 'Interior',
      bloom: 'Blossom',
    };
    const globalBiomePath = biomePathMap[municipalityBiome] || 'Montanya';

    const stampsDir = path.join(process.cwd(), 'public', 'stamps', globalBiomePath);
    let availableStampImages: string[] = [];
    try {
      availableStampImages = fs.readdirSync(stampsDir)
        .filter((f: string) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort();
    } catch {
      availableStampImages = ['bolet.webp'];
    }

    const routes = await rls.route.findMany({
      include: {
        routePois: {
          include: {
            poi: {
              include: {
                userUnlocks: {
                  where: { userId },
                  select: { unlockedAt: true, earnedXp: true, quizSolved: true }
                }
              }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return await Promise.all(routes.map(async (route) => {
      const orderedPois = route.routePois.map(rp => {
        const unlock = rp.poi.userUnlocks[0] || null;
        return {
          id: rp.poi.id,
          title: rp.poi.title,
          isVisited: unlock !== null,
          quizSolved: unlock?.quizSolved ?? false,
          unlockedAt: unlock?.unlockedAt ?? null,
          hasQuiz: !!rp.poi.manualQuiz,
        };
      });

      const totalPois = orderedPois.length;
      const visitedPois = orderedPois.filter(p => p.isVisited).length;
      const quizDonePois = orderedPois.filter(p => p.quizSolved).length;
      const isCompleted = totalPois > 0 && visitedPois === totalPois;

      const unlockDates = orderedPois
        .filter(p => p.unlockedAt)
        .map(p => new Date(p.unlockedAt!).getTime());
      const latestDate = unlockDates.length > 0
        ? new Date(Math.max(...unlockDates)).toLocaleDateString('ca-ES', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
        : null;

      const routeTheme = route.themeId?.toLowerCase() || municipalityBiome;
      const routeBiomePath = biomePathMap[routeTheme] || globalBiomePath;

      const hashCode = route.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const imgIndex = availableStampImages.length > 0 ? hashCode % availableStampImages.length : 0;
      const stampImage = availableStampImages[imgIndex] || 'bolet.webp';
      const stampUrl = `/stamps/${globalBiomePath}/${stampImage}`;

      const progress = await rls.userRouteProgress.findUnique({
        where: { userId_routeId: { userId, routeId: route.id } }
      });

      return {
        id: route.id,
        name: route.name || route.slug || 'Ruta',
        biome: routeTheme,
        biomePath: routeBiomePath,
        stampUrl,
        totalPois: Math.max(totalPois, 1),
        visitedPois,
        quizDonePois,
        poisProgress: orderedPois,
        isCompleted: !!progress,
        rating: progress?.rating ?? 0,
        comment: progress?.comment ?? "",
        date: latestDate,
      };
    }));
  } catch (err) {
    console.error('[getPassportData error]', err);
    return [];
  }
}

export async function getPoisWithinRadius(lon: number, lat: number, radiusMeters: number) {
  const pois = await prisma.$queryRaw<any[]>`
    SELECT id, title, ST_AsGeoJSON(location)::jsonb as geojson
    FROM "pois"
    WHERE ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
      ${radiusMeters}
    );
  `;

  return pois.map(p => ({
    ...p,
    location: p.geojson
  }));
}

export async function updatePoiLocation(poiId: string, lon: number, lat: number) {
  return await prisma.$executeRaw`
    UPDATE "pois"
    SET location = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
    WHERE id = ${poiId}::uuid;
  `;
}

export async function getUserLastLocation(userId: string) {
  const result = await withRLS(userId).$queryRaw<any[]>`
    SELECT ST_AsGeoJSON(location)::jsonb as geojson, timestamp
    FROM "user_telemetry"
    WHERE user_id = ${userId}::uuid
    ORDER BY timestamp DESC
    LIMIT 1;
  `;
  
  return result.length > 0 ? result[0] : null;
}


import { prisma } from "../database/prisma";
import { unstable_noStore as noStore } from 'next/cache';

export async function getAppBranding() {
  // noStore(); // Don't use noStore here to avoid build issues, rely on fetch revalidation if needed
  try {
    const m = await prisma.municipality.findFirst({
      orderBy: { createdAt: 'asc' }
    });
    return m;
  } catch (e) {
    console.error(" [Error in getAppBranding]:", e);
    return null;
  }
}

export async function getMunicipalities() {
  noStore();
  try {
    return await prisma.municipality.findMany({
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
              include: { userUnlocks: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const legends = routes.map((route: any) => ({
      id: route.id,
      name: route.name,
      municipality_name: route.municipality?.name || 'Senses municipi',
      pois_count: route.routePois?.length || 0,
      total_visits: route.routePois?.reduce((acc: number, rp: any) => acc + (rp.poi?.userUnlocks?.length || 0), 0) || 0,
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
    return await prisma.profile.findMany({
      orderBy: { createdAt: 'desc' }
    });
  } catch (err) {
    console.error(" [Error in getAllProfiles]:", err);
    return [];
  }
}

export async function getLegends() {
  noStore();
  try {
    const routes = await prisma.route.findMany({
      include: {
        municipality: { select: { name: true } },
        routePois: {
          include: {
            poi: {
              include: { userUnlocks: true }
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
    // Extraiem lat/lng si el camp location (geometry) és present
    // Nota: En Prisma Unsupported, depèn de com es retorni (Buffer o objecte)
    const lat = p.location?.y ?? p.latitude ?? 0;
    const lng = p.location?.x ?? p.longitude ?? 0;

    return {
      ...p,
      id: p.id,
      title: p.title,
      description: p.description || '',
      latitude: lat,
      longitude: lng,
      image_url: p.appThumbnail || p.images?.[0] || '',
      orderIndex: rp.orderIndex ?? 0,
      icon: p.icon || null,
      textContent: p.textContent || '',
      audioUrl: p.audioUrl || '',
      videoUrls: p.videoUrls || [],
      carouselImages: p.carouselImages || [],
      header16x9: p.header16x9 || '',
      is_recapture: p.isRecapture || false,
      appThumbnail: p.appThumbnail || '',
      images: p.images || [],
      videoMetadata: p.videoMetadata || {},
      manualQuiz: p.manualQuiz,
      type: p.type,
      userUnlocks: p.userUnlocks || [],
      routeId: route.id,
    };
  }) ?? [];

  const firstPoi = pois[0];
  const muniName = (route.municipality?.name || route.municipality_name || '').replace(/^Ajuntament de /i, '');
  const title = route.title || route.name || route.slug || 'Sense Títol';

  return {
    id: route.id,
    title: title,
    description: route.description || '',
    category: route.themeId || '',
    location_name: muniName || route.location_name || '',
    latitude: firstPoi?.latitude ?? 0,
    longitude: firstPoi?.longitude ?? 0,
    image_url: route.thumbnail1x1 || firstPoi?.appThumbnail || firstPoi?.images?.[0] || '',
    hero_image_url: route.thumbnail1x1 || firstPoi?.header16x9 || '',
    audio_url: '',
    video_url: '',
    icon: firstPoi?.icon || null,
    is_active: true,
    poiCount: pois.length,
    pois,
    thumbnail1x1: route.thumbnail1x1 || '',
    downloadRequired: route.downloadRequired || false,
    textContent: '',
    videoUrls: [],
    carouselImages: [],
    header16x9: '',
    images: [],
    manualQuiz: null,
    userUnlocks: [],
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
    const unlocks = await prisma.userUnlock.findMany({
      where: { userId },
      select: { earnedXp: true, quizSolved: true }
    });

    const routePointsCount = await prisma.userRouteProgress.count({
      where: { userId }
    });

    const finalQuizzesPassedCount = await prisma.userRouteProgress.count({
      where: { userId, finalQuizPassed: true }
    });

    const totalScore = unlocks.reduce((acc, curr) => acc + (curr.earnedXp || 0), 0) + (routePointsCount * 500) + (finalQuizzesPassedCount * 1000);
    const solvedQuizzesCount = unlocks.filter(u => u.quizSolved).length;

    return {
      totalScore,
      solvedQuizzesCount
    };
  } catch (err) {
    console.error('[getUserScore error]', err);
    return { totalScore: 0, solvedQuizzesCount: 0 };
  }
}

export async function getPassportData(userId: string) {
  noStore();
  if (!userId) return [];

  // Protecció de build: importació dinàmica de mòduls de Node
  const path = await import('path');
  const fs = await import('fs');

  try {
    const municipality = await prisma.municipality.findFirst({
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

    const routes = await prisma.route.findMany({
      where: { routePois: { some: {} } },
      include: {
        routePois: {
          include: {
            poi: {
              include: {
                userUnlocks: {
                  where: { userId },
                  select: { progress: true, unlockedAt: true, earnedXp: true, quizSolved: true }
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
          isQuizDone: unlock !== null && (unlock.progress ?? 0) >= 1.0,
          quizSolved: unlock?.quizSolved ?? false,
          progress: unlock?.progress ?? 0,
          unlockedAt: unlock?.unlockedAt ?? null,
          hasQuiz: !!rp.poi.manualQuiz,
        };
      });

      const totalPois = orderedPois.length;
      const visitedPois = orderedPois.filter(p => p.isVisited).length;
      const quizDonePois = orderedPois.filter(p => p.isQuizDone).length;
      const isCompleted = totalPois > 0 && quizDonePois === totalPois;

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

      let routeStampImages = availableStampImages;
      if (routeBiomePath !== globalBiomePath) {
        const routeStampsDir = path.join(process.cwd(), 'public', 'stamps', routeBiomePath);
        try {
          routeStampImages = fs.readdirSync(routeStampsDir)
            .filter((f: string) => /\.(png|jpg|jpeg|webp)$/i.test(f))
            .sort();
        } catch {
          routeStampImages = availableStampImages;
        }
      }

      const hashCode = route.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const imgIndex = routeStampImages.length > 0 ? hashCode % routeStampImages.length : 0;
      const stampImage = routeStampImages[imgIndex] || routeStampImages[0] || 'bolet.webp';
      const stampUrl = `/stamps/${routeBiomePath}/${stampImage}`;

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
        isCompleted,
        date: latestDate,
        finalQuizPassed: (await prisma.userRouteProgress.findUnique({
          where: { userId_routeId: { userId, routeId: route.id } }
        }))?.finalQuizPassed ?? false,
      };
    }));
  } catch (err) {
    console.error('[getPassportData error]', err);
    return [];
  }
}

/**
 * PAS 4: Helper per a consultes espacials PostGIS
 */
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

/**
 * Helper per actualitzar la ubicació d'un POI (Escritura en camp Unsupported)
 */
export async function updatePoiLocation(poiId: string, lon: number, lat: number) {
  return await prisma.$executeRaw`
    UPDATE "pois"
    SET location = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
    WHERE id = ${poiId}::uuid;
  `;
}

/**
 * Obté l'última telemetria d'un usuari
 */
export async function getUserLastLocation(userId: string) {
  const result = await prisma.$queryRaw<any[]>`
    SELECT ST_AsGeoJSON(location)::jsonb as geojson, timestamp
    FROM "user_telemetry"
    WHERE user_id = ${userId}::uuid
    ORDER BY timestamp DESC
    LIMIT 1;
  `;
  
  return result.length > 0 ? result[0] : null;
}

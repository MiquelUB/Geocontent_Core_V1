import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { getExecutiveAnalytics } from '@/lib/analytics';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    // SEC-02: Auth guard — dades d'analítica protegides
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autoritzat.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const municipalityId = searchParams.get('municipalityId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!municipalityId || !uuidRegex.test(municipalityId)) {
      console.warn("Invalid or missing municipalityId:", municipalityId);
      return NextResponse.json({ success: false, error: "MunicipalityId no vàlid o inexistent" }, { status: 400 });
    }

    // Check ownership or super admin role
    const userRole = (session.user as any).role as string;
    const userMunicipalityId = (session.user as any).municipalityId as string | null;

    const isAuthorized =
      userRole === 'SUPER_ADMIN' ||
      (userRole === 'ADMIN' && userMunicipalityId === municipalityId);

    if (!isAuthorized) {
      console.warn(`[Analytics] Accés denegat: user ${session.user.id} (${userRole}) intentant accedir a municipi ${municipalityId}`);
      return NextResponse.json({ success: false, error: 'Accés denegat.' }, { status: 403 });
    }

    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam ? new Date(endDateParam) : now;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ success: false, error: "Dates no vàlides" }, { status: 400 });
    }

    console.log(`[Analytics] Processing for ${municipalityId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    let analytics;
    try {
      analytics = await getExecutiveAnalytics(municipalityId, startDate, endDate);
    } catch (err: any) {
      console.error("Error in getExecutiveAnalytics:", err);
      throw new Error(`Error processant analítiques base: ${err.message}`);
    }

    const muniRoutes = await prisma.route.findMany({
      where: { municipalityId },
      select: { id: true }
    });
    const routeFilter = muniRoutes.length > 0 ? { municipalityId } : {};

    // 4. Heatmap Data & Real-Time User Condensation
    let heatmapPoints: any[] = [];
    try {
      // a) Punts GPS de la taula user_telemetry
      const telemetry = await prisma.$queryRaw<any[]>`
        SELECT 
          ST_X(location::geometry) as longitude, 
          ST_Y(location::geometry) as latitude, 
          timestamp
        FROM user_telemetry
        LIMIT 2000
      `;

      // b) Punts de desbloqueig de POIs en temps real pels usuaris
      const unlocks = await prisma.userUnlock.findMany({
        where: {
          poi: { routePois: { some: { route: routeFilter } } }
        },
        select: {
          unlockedAt: true,
          poi: { select: { id: true, title: true, latitude: true, longitude: true } }
        }
      });

      const unlockPoints = unlocks
        .filter(u => u.poi?.latitude && u.poi?.longitude)
        .map(u => ({
          latitude: Number(u.poi.latitude),
          longitude: Number(u.poi.longitude),
          timestamp: u.unlockedAt.toISOString(),
          weight: 2 // Major pes visual per activitats directes
        }));

      const telemetryPoints = (telemetry || [])
        .filter(t => t.latitude && t.longitude)
        .map(t => ({
          latitude: Number(t.latitude),
          longitude: Number(t.longitude),
          timestamp: t.timestamp,
          weight: 1
        }));

      heatmapPoints = [...telemetryPoints, ...unlockPoints];
    } catch (err: any) {
      console.error("Error fetching heatmap points:", err);
      heatmapPoints = [];
    }

    // 5. Calculate Municipality Map Center & POIs List
    let municipalityPois: any[] = [];
    try {
      let poisRaw = await prisma.poi.findMany({
        where: {
          routePois: {
            some: { route: routeFilter }
          }
        },
        select: {
          id: true,
          title: true,
          latitude: true,
          longitude: true
        }
      });

      if (poisRaw.length === 0) {
        poisRaw = await prisma.poi.findMany({
          select: { id: true, title: true, latitude: true, longitude: true },
          take: 100
        });
      }

      municipalityPois = poisRaw.filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number' && (p.latitude !== 0 || p.longitude !== 0));
    } catch (err: any) {
      console.error("Error fetching municipality POIs for center calculation:", err);
      municipalityPois = [];
    }

    let mapCenter: [number, number] = [1.5209, 41.5912]; // Default fallback

    if (municipalityPois.length > 0) {
      const avgLat = municipalityPois.reduce((s, p) => s + Number(p.latitude), 0) / municipalityPois.length;
      const avgLng = municipalityPois.reduce((s, p) => s + Number(p.longitude), 0) / municipalityPois.length;
      mapCenter = [avgLng, avgLat];
    }

    return NextResponse.json({
      success: true,
      data: {
        ...analytics,
        heatmap: heatmapPoints,
        mapCenter,
        pois: municipalityPois
      }
    });

  } catch (error: any) {
    console.error("Analytics Error Details:", {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return NextResponse.json({ success: false, error: "Failed to fetch executive report", details: error.message }, { status: 500 });
  }
}

function calculateChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function generateInsights(users: number, completes: number, quizRate: number, abandonment: number): string {
  if (users === 0) return "S'espera aplegar dades del primer visitant per generar conclusions.";
  let insight = `S'han registrat ${users} visitants interactuant en aquest període. `;
  if (abandonment > 40) insight += `L'abandonament és elevat (${abandonment}%). `;
  if (quizRate > 80) insight += `L'èxit als reptes és excel·lent (${quizRate}%).`;
  return insight;
}

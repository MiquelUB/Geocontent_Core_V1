import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { getExecutiveAnalytics } from '@/lib/analytics';
import { auth } from '@/auth';

function parseDateParam(dateStr?: string | null, isEnd = false): Date {
  if (!dateStr) {
    const d = new Date();
    if (isEnd) {
      d.setHours(23, 59, 59, 999);
    } else {
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }

  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (isEnd && !dateStr.includes('23:59:59')) {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  }

  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const [y, m, d] = parts;
    if (isEnd) {
      return new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  const parsed = new Date(dateStr);
  if (isEnd) parsed.setHours(23, 59, 59, 999);
  else parsed.setHours(0, 0, 0, 0);
  return parsed;
}

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

    const startDate = parseDateParam(startDateParam, false);
    const endDate = parseDateParam(endDateParam, true);

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

    // 4. Heatmap Data per Període Històric (startDate - endDate)
    let heatmapPoints: any[] = [];
    try {
      const hasMuniRoutes = muniRoutes.length > 0;
      const unlocks = hasMuniRoutes ? await prisma.userUnlock.findMany({
        where: {
          unlockedAt: { gte: startDate, lte: endDate },
          poi: { routePois: { some: { route: { municipalityId } } } }
        },
        select: {
          unlockedAt: true,
          poi: { select: { id: true, title: true, latitude: true, longitude: true } }
        }
      }) : [];

      const unlockPoints = unlocks
        .filter(u => u.poi?.latitude && u.poi?.longitude)
        .map(u => ({
          latitude: Number(u.poi.latitude),
          longitude: Number(u.poi.longitude),
          timestamp: u.unlockedAt.toISOString(),
          weight: 2 // Major pes visual per activitats directes
        }));

      heatmapPoints = unlockPoints;
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
            some: { route: { municipalityId } }
          }
        },
        select: {
          id: true,
          title: true,
          latitude: true,
          longitude: true
        }
      });

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

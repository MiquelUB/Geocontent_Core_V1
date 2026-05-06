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

    if (!municipalityId || municipalityId === 'undefined' || municipalityId === 'null') {
      return NextResponse.json({ success: false, error: "Missing municipalityId" }, { status: 400 });
    }

    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam ? new Date(endDateParam) : now;

    const analytics = await getExecutiveAnalytics(municipalityId, startDate, endDate);

    // 4. Heatmap Data (Telemetry) & Map Center
    const municipalityRoutes = await prisma.route.findMany({
      where: { municipalityId },
      select: { id: true }
    });
    const routeIds = municipalityRoutes.map(r => r.id);

    const telemetry = await prisma.userTelemetry.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        route_id: { in: routeIds }
      },
      take: 2000,
      select: { latitude: true, longitude: true, timestamp: true }
    });

    // Calculate Center
    const municipalityPois = await prisma.poi.findMany({
      where: { municipalityId },
      select: { latitude: true, longitude: true },
      take: 50 // Limit for performance
    });

    let mapCenter = [1.13404, 42.44391]; // Default to Rialp center [Lng, Lat]

    // Attempt to get center from organization if possible
    const org = await prisma.organization.findFirst({
      select: { centerLatitude: true, centerLongitude: true }
    });
    if (org?.centerLatitude && org?.centerLongitude) {
      mapCenter = [org.centerLongitude, org.centerLatitude];
    }

    if (municipalityPois.length > 0) {
      const validPois = municipalityPois.filter(p => p.latitude && p.longitude);
      if (validPois.length > 0) {
        const avgLat = validPois.reduce((s, p) => s + p.latitude!, 0) / validPois.length;
        const avgLng = validPois.reduce((s, p) => s + p.longitude!, 0) / validPois.length;
        mapCenter = [avgLng, avgLat];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...analytics,
        heatmap: telemetry,
        mapCenter
      }
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch executive report" }, { status: 500 });
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

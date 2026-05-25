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

    // 4. Heatmap Data (Telemetry) - Extracció mitjançant PostGIS
    let telemetry: any[] = [];
    try {
      telemetry = await prisma.$queryRaw<any[]>`
        SELECT 
          ST_X(location::geometry) as longitude, 
          ST_Y(location::geometry) as latitude, 
          timestamp
        FROM user_telemetry
        WHERE timestamp >= ${startDate} AND timestamp <= ${endDate}
        AND user_id IN (SELECT id FROM users WHERE municipality_id = ${municipalityId}::uuid)
        LIMIT 2000
      `;
    } catch (err: any) {
      console.error("Error fetching telemetry heatmap:", err);
      // No fem fallar tota la request si només falla el heatmap
      telemetry = [];
    }

    // 5. Calculate Center from POIs using PostGIS
    let municipalityPois: any[] = [];
    try {
      municipalityPois = await prisma.$queryRaw<any[]>`
        SELECT 
          ST_X(location::geometry) as longitude, 
          ST_Y(location::geometry) as latitude
        FROM pois
        WHERE id IN (
          SELECT poi_id FROM route_pois rp
          JOIN routes r ON rp.route_id = r.id
          WHERE r.municipality_id = ${municipalityId}::uuid
        )
        LIMIT 50
      `;
    } catch (err: any) {
      console.error("Error fetching municipality POIs for center calculation:", err);
      municipalityPois = [];
    }

    let mapCenter = [1.13404, 42.44391]; // Default to Rialp center [Lng, Lat]

    if (municipalityPois.length > 0) {
      const validPois = municipalityPois.filter(p => p.latitude && p.longitude);
      if (validPois.length > 0) {
        const avgLat = validPois.reduce((s, p) => s + (p.latitude as number), 0) / validPois.length;
        const avgLng = validPois.reduce((s, p) => s + (p.longitude as number), 0) / validPois.length;
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

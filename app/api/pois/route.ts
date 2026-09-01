import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withCors, handleOptions } from "@/lib/api/cors";
import { rateLimit } from "@/lib/services/ratelimit";

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const rl = await rateLimit(`api:pois:${ip}`, 60, 60);
  if (!rl.success) {
    return withCors(request, new NextResponse('Too Many Requests', { status: 429 }));
  }

  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("route_id");
  const lang = searchParams.get("lang") || "ca";

  if (!routeId) {
    return NextResponse.json(
      { error: "route_id parameter is required" },
      { status: 400 }
    );
  }

  try {
    const route = await prisma.route.findFirst({
      where: {
        id: routeId,
        status: 'CLOSED',
        municipality: {
          planTier: { not: 'inactive' }
        }
      },
      select: { id: true }
    });

    if (!route) {
      return NextResponse.json({ error: 'Route not found or inactive' }, { status: 404 });
    }

    const routePois = await prisma.routePoi.findMany({
      where: { routeId: routeId },
      include: {
        poi: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    // Apply i18n translations
    const localizedData = routePois.map((rp) => {
      const poi = rp.poi;
      
      let localizedQuiz = poi.manualQuiz;
      if (lang !== 'ca' && poi.manualQuiz && (poi.manualQuiz as any).translations && (poi.manualQuiz as any).translations[lang]) {
          localizedQuiz = {
              ...(poi.manualQuiz as any),
              ...(poi.manualQuiz as any).translations[lang]
          };
          delete localizedQuiz.translations;
      }

      return {
        ...poi,
        title: getTranslation(poi.title, poi.titleTranslations as any, lang),
        description: getTranslation(poi.description, poi.descriptionTranslations as any, lang),
        quiz_question: getTranslation(poi.textContent, poi.textContent as any, lang), // El model legacy guardava la pregunta en textContent o similar
        manualQuiz: localizedQuiz,
      };
    });

    return withCors(request, NextResponse.json(localizedData));
  } catch (error: any) {
    console.error("[API /pois] Error:", error);
    return withCors(request, NextResponse.json({ error: error.message }, { status: 500 }));
  }
}

function getTranslation(
  original: string | null,
  translations: Record<string, string> | null,
  lang: string
): string | null {
  if (!original) return null;
  if (lang === "ca") return original;
  if (translations && translations[lang]) return translations[lang];
  return original;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withCors, handleOptions } from "@/lib/api/cors";
import { rateLimit } from "@/lib/services/ratelimit";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      
      let localizedQuiz: any = poi.manualQuiz;
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
        textContent: getTranslation(poi.textContent, (poi as any).textContentTranslations, lang),
        audioUrl: getAudioTranslation(poi.audioUrl, (poi as any).audioTranslations, lang),
        videoUrls: getVideoTranslations(poi.videoUrls, (poi as any).videoTranslations, lang),
        quiz_question: getTranslation(poi.textContent, (poi as any).textContentTranslations, lang),
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

function getAudioTranslation(
  original: string | null,
  translations: Record<string, string> | null,
  lang: string
): string | null {
  if (!original) return null;
  if (lang === "ca" || !translations) return original;
  if (typeof translations === "object" && translations[lang]) {
    return translations[lang];
  }
  return original;
}

function getVideoTranslations(
  originalUrls: string[] | null,
  videoTranslations: Record<string, any> | null,
  lang: string
): string[] {
  if (!originalUrls || originalUrls.length === 0) return [];
  if (lang === "ca" || !videoTranslations) return originalUrls;
  
  let vTrans = videoTranslations;
  if (typeof vTrans === 'string') {
    try { vTrans = JSON.parse(vTrans); } catch (e) { return originalUrls; }
  }
  if (!vTrans || typeof vTrans !== 'object') return originalUrls;

  return originalUrls.map((url) => {
    let trans = vTrans[url];
    if (!trans && url) {
      const urlClean = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
      for (const key of Object.keys(vTrans)) {
        const keyClean = decodeURIComponent(key.split('?')[0].split('/').pop() || '');
        if (key === url || (urlClean && keyClean && urlClean === keyClean)) {
          trans = vTrans[key];
          break;
        }
      }
    }
    if (!trans && Object.keys(vTrans).length === 1 && typeof Object.values(vTrans)[0] === 'object') {
      trans = Object.values(vTrans)[0];
    }
    if (trans && typeof trans === 'object' && trans[lang]) {
      const tUrl = trans[lang];
      if (typeof tUrl === 'string' && tUrl.startsWith('http') && !tUrl.includes('/ERROR')) {
        return tUrl;
      }
    }
    return url;
  });
}

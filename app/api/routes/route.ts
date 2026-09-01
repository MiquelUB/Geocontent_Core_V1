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
  const rl = await rateLimit(`api:routes:${ip}`, 60, 60);
  if (!rl.success) {
    return withCors(request, new NextResponse('Too Many Requests', { status: 429 }));
  }

  const { searchParams } = new URL(request.url);
  const municipalitySlug = searchParams.get("municipality");
  const theme = searchParams.get("theme");
  const includeExpired = searchParams.get("include_expired") === "true";
  const lang = searchParams.get("lang") || "ca";

  try {
    // 1. Preparem el filtratge
    const where: any = {
      status: 'CLOSED', // Només rutes publicades
      municipality: {
        planTier: { not: 'inactive' }
      }
    };

    if (municipalitySlug) {
      where.municipality = {
        slug: municipalitySlug,
        planTier: { not: 'inactive' }
      };
    }

    if (theme) {
      where.themeId = theme;
    }

    // Filtre de rutes temporals (DEFAULT: només vigents)
    if (!includeExpired) {
      const now = new Date();
      where.OR = [
        { availabilityType: 'permanent' },
        { 
          AND: [
            { availabilityType: { in: ['temporal', 'event'] } },
            {
              OR: [
                { endDate: null },
                { endDate: { gte: now } }
              ]
            }
          ]
        }
      ];
    }

    // 2. Executem la query amb Prisma
    const routes = await prisma.route.findMany({
      where,
      include: {
        municipality: {
          select: { name: true, slug: true, logoUrl: true }
        },
        routePois: {
          orderBy: { orderIndex: 'asc' },
          include: {
            poi: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Adaptem el format per al frontend i apliquem i18n
    const formattedData = routes.map((route) => {
      const pois = route.routePois.map(rp => {
        const poi = rp.poi;
        let localizedQuiz = poi.manualQuiz;
        if (lang !== 'ca' && poi.manualQuiz && (poi.manualQuiz as any).translations && (poi.manualQuiz as any).translations[lang]) {
            localizedQuiz = {
                ...(poi.manualQuiz as any),
                ...(poi.manualQuiz as any).translations[lang]
            };
            delete (localizedQuiz as any).translations;
        }

        return {
          ...poi,
          title: getTranslation(poi.title, (poi as any).titleTranslations, lang),
          description: getTranslation(poi.description, (poi as any).descriptionTranslations, lang),
          textContent: getTranslation(poi.textContent, (poi as any).textContentTranslations, lang),
          audioUrl: getAudioTranslation(poi.audioUrl, (poi as any).audioTranslations, lang),
          videoUrls: getVideoTranslations(poi.videoUrls, (poi as any).videoTranslations, lang),
          quiz_question: getTranslation(poi.textContent, (poi as any).textContentTranslations, lang),
          manualQuiz: localizedQuiz,
        };
      });
      
      let localizedFinalQuiz: any = route.finalQuiz;
      if (lang !== 'ca' && route.finalQuiz && (route.finalQuiz as any).translations && (route.finalQuiz as any).translations[lang]) {
          localizedFinalQuiz = {
              ...(route.finalQuiz as any),
              ...(route.finalQuiz as any).translations[lang]
          };
          delete localizedFinalQuiz.translations;
      }
      
      return {
        ...route,
        pois,
        title: getTranslation(route.name, route.nameTranslations as any, lang),
        description: getTranslation(route.description, route.descriptionTranslations as any, lang),
        finalQuiz: localizedFinalQuiz,
      };
    });

    return withCors(request, NextResponse.json(formattedData));
  } catch (error: any) {
    console.error("[API /routes] Error:", error);
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

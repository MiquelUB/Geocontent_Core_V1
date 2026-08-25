import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withCors, handleOptions } from "@/lib/api/cors";
import { rateLimit } from "@/lib/services/ratelimit";

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
            poi: {
              select: { id: true, title: true, icon: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Adaptem el format per al frontend i apliquem i18n
    const formattedData = routes.map((route) => {
      const pois = route.routePois.map(rp => rp.poi);
      
      return {
        ...route,
        pois,
        title: getTranslation(route.name, route.nameTranslations as any, lang),
        description: getTranslation(route.description, route.descriptionTranslations as any, lang),
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

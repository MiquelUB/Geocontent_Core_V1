import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") || "ca";

  try {
    const municipalities = await prisma.municipality.findMany({
      where: {
        planTier: { not: 'inactive' }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        themeId: true,
        nameTranslations: true,
        _count: {
          select: { routes: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedData = municipalities.map((muni) => ({
      ...muni,
      name: getTranslation(muni.name, muni.nameTranslations as any, lang),
      routes_count: muni._count.routes // Manté el format esperat pel frontend
    }));

    return NextResponse.json(formattedData);
  } catch (error: any) {
    console.error("[API /municipalities] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

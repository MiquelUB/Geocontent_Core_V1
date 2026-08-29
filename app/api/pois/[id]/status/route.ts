import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const poi = await prisma.poi.findUnique({
      where: { id },
      select: { videoTranslations: true, audioTranslations: true }
    });

    if (!poi) {
      return NextResponse.json({ error: "POI not found" }, { status: 404 });
    }

    return NextResponse.json({
      videoTranslations: poi.videoTranslations || {},
      audioTranslations: poi.audioTranslations || {}
    });
  } catch (e) {
    console.error("Error fetching POI status:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

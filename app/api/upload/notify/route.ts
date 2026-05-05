import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { videoQueue } from '@/lib/queue/client';

/**
 * POST /api/upload/notify
 *
 * Cridat pel browser DESPRÉS de la pujada directa a S3.
 * 1. Actualitza poi.videoUrls amb la URL pública (immediat)
 * 2. Escriu un OutboxEvent perquè el worker Python (ARQ) faci la transcodificació HLS
 *
 * Body:
 * {
 *   poiId: string,
 *   publicUrl: string,       // URL pública S3 del vídeo raw
 *   storagePath: string,     // Ruta interna S3 (per al worker)
 *   type: 'snack' | 'dinner',
 *   duration: number,
 *   fileName: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poiId, publicUrl, storagePath, type, duration, fileName } = body;

    if (!poiId || !publicUrl) {
      return NextResponse.json({ error: 'poiId and publicUrl are required' }, { status: 400 });
    }

    // 1. Guardem la URL raw immediatament perquè sigui accessible
    const poi = await prisma.poi.findUnique({ where: { id: poiId }, select: { videoUrls: true } });
    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    const currentUrls: string[] = (poi.videoUrls as string[]) ?? [];
    const updatedUrls = [...currentUrls, publicUrl].slice(0, 3); // Max 3 videos

    await prisma.poi.update({
      where: { id: poiId },
      data: { videoUrls: updatedUrls },
    });

    // 2. Outbox Pattern: escrivim l'event per al worker Python (ARQ)
    try {
      const safeFileName = (fileName ?? 'video').replace(/[^a-z0-9_-]/gi, '_');

      await videoQueue.add('transcode', {
        poiId,
        publicUrl,
        storagePath,
        outputDir: `videos/${poiId}`,
        fileName: safeFileName,
        type: type ?? 'dinner',
        duration: duration ?? 0,
      });

      console.log(`[notify] Outbox event creat per POI ${poiId} — ${fileName}`);
    } catch (outboxErr: any) {
      // L'error d'Outbox no és fatal: la URL raw ja s'ha guardat
      console.warn('[notify] Outbox write failed (non-fatal):', outboxErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `URL saved. Transcoding queued via Outbox Pattern.`,
    });
  } catch (err: any) {
    console.error('[notify] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

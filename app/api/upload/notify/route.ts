import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { videoQueue } from '@/lib/queue/client';
import { auth } from '@/auth';

/**
 * POST /api/upload/notify
 */
export async function POST(req: NextRequest) {
  try {
    // 1. SEC-01: Zero Trust Session Guard
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { poiId, publicUrl, storagePath, type, duration, fileName } = body;

    // 2. Validació d'entrada bàsica
    if (!poiId || !publicUrl || !storagePath) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 3. SEC-07: Verificar que la URL prové del nostre S3
    const s3Endpoint = process.env.S3_ENDPOINT || '';
    if (!publicUrl.startsWith(s3Endpoint)) {
        console.warn(`[notify] Suspicious URL blocked: ${publicUrl}`);
        return NextResponse.json({ error: 'Forbidden: Invalid source URL' }, { status: 403 });
    }

    // 4. Validar existència del POI
    const poi = await prisma.poi.findUnique({ 
        where: { id: poiId }, 
        select: { id: true, videoUrls: true } 
    });
    
    if (!poi) {
      return NextResponse.json({ error: 'POI not found' }, { status: 404 });
    }

    // 5. Actualització de dades (Impedir injeccions massives)
    const currentUrls: string[] = Array.isArray(poi.videoUrls) ? poi.videoUrls : [];
    if (currentUrls.includes(publicUrl)) {
        return NextResponse.json({ success: true, message: 'URL already registered' });
    }
    
    const updatedUrls = [...currentUrls, publicUrl].slice(0, 3); // Max 3 videos

    await prisma.poi.update({
      where: { id: poiId },
      data: { videoUrls: updatedUrls },
    });

    // 6. Outbox Pattern: Transcodificació asíncrona (Múscul Python)
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
      console.warn('[notify] Outbox write failed (non-fatal):', outboxErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `URL saved and queued for processing.`,
    });
  } catch (err: any) {
    console.error('[notify] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

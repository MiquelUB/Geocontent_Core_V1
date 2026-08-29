import { NextRequest } from 'next/server';
import { prisma } from '@/lib/database/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // Set up Server-Sent Events headers
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let isClosed = false;

  req.signal.addEventListener('abort', () => {
    isClosed = true;
    writer.close();
  });

  // Obtenim l'estat inicial per poder comparar
  let lastState: any = null;
  try {
    lastState = await prisma.poi.findUnique({
      where: { id },
      select: { videoTranslations: true, audioTranslations: true }
    });
  } catch (e) {}

  const pollInterval = setInterval(async () => {
    if (isClosed) {
      clearInterval(pollInterval);
      return;
    }
    
    try {
      const currentState = await prisma.poi.findUnique({
        where: { id },
        select: { videoTranslations: true, audioTranslations: true }
      });

      if (currentState) {
        const lastV = JSON.stringify(lastState?.videoTranslations || {});
        const currV = JSON.stringify(currentState.videoTranslations || {});
        const lastA = JSON.stringify(lastState?.audioTranslations || {});
        const currA = JSON.stringify(currentState.audioTranslations || {});

        if (lastV !== currV) {
          writer.write(encoder.encode(`data: ${JSON.stringify({ status: 'SUCCESS', type: 'VIDEO_TRANSLATION' })}\n\n`));
        }
        if (lastA !== currA) {
          writer.write(encoder.encode(`data: ${JSON.stringify({ status: 'SUCCESS', type: 'AUDIO_GENERATION' })}\n\n`));
        }
        
        lastState = currentState;
      }
      
      // Ping per mantenir la connexió viva a través de proxies/Vercel
      writer.write(encoder.encode(`: ping\n\n`));
    } catch (e) {
      console.error("Error polling DB in SSE:", e);
    }
  }, 3000); // Comprova la BD cada 3 segons des del servidor

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Evita que Vercel / Nginx bloquegi l'stream
    },
  });
}

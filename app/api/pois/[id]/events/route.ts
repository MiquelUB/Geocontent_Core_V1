export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import redis from '@/lib/services/redis';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // Set up Server-Sent Events headers
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Create a duplicate redis connection for subscribing (since subscribe blocks)
  const sub = redis.duplicate();

  const channel = `poi_updates:${id}`;

  sub.on('message', (chan, message) => {
    if (chan === channel) {
      writer.write(encoder.encode(`data: ${message}\n\n`));
    }
  });

  sub.subscribe(channel).catch((err) => {
    console.error(`Error subscribing to Redis channel ${channel}:`, err);
  });

  // Keep-alive ping every 15 seconds to prevent connection drops (e.g. from reverse proxies like PgBouncer/Nginx)
  const pingInterval = setInterval(() => {
    writer.write(encoder.encode(`: ping\n\n`));
  }, 15000);

  // Handle client disconnect
  req.signal.addEventListener('abort', () => {
    clearInterval(pingInterval);
    sub.unsubscribe(channel);
    sub.quit();
    writer.close();
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

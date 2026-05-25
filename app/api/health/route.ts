import { NextResponse } from 'next/server';

/**
 * Lightweight health endpoint used by the network latency probe.
 * Returns minimal payload — the client measures round-trip time.
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}

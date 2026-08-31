import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const bucket = url.searchParams.get('bucket') || 'pxx-core-v1';
  const prefix = url.searchParams.get('prefix') || '';
  
  const fastApiUrl = process.env.INTERNAL_API_URL || 'http://api_core:8000';
  
  try {
    const res = await fetch(`${fastApiUrl}/s3/debug-list?bucket=${bucket}&prefix=${prefix}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

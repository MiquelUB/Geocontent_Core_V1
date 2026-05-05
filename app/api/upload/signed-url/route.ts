import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSignedUrl } from '@/lib/services/s3';

/**
  * GET /api/upload/signed-url?fileName=video.mp4&bucket=geocontent&contentType=video/mp4
  *
  * Returns a short-lived signed upload URL so the browser can PUT
  * the file directly to S3 Storage — bypassing Next.js completely.
  *
  * Next.js never receives the file bytes. Memory footprint: ~0.
  */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName') ?? 'upload';
    
    // Sanitize filename: remove spaces and non-standard characters
    const safeName = fileName.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `${uuidv4()}_${safeName}`;

    // Request a signed upload URL (expires in 15 minutes)
    const signedUrl = await getSignedUrl(storagePath, 900);

    // Calculate public URL based on endpoint and bucket
    const s3Endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
    const bucket = process.env.S3_BUCKET || 'geocontent';
    const publicUrl = `${s3Endpoint}/${bucket}/${storagePath}`;

    return NextResponse.json({
      signedUrl,        // Browser PUTs here directly
      storagePath,      // Used in /api/upload/notify
      publicUrl,        // Final URL stored in DB
    });
  } catch (err: any) {
    console.error('[signed-url] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


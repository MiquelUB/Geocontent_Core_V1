import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getSignedUrl } from '@/lib/services/s3';
import { auth } from '@/auth';

// SEC-12: Whitelist de formats permesos per pujada directa
const ALLOWED_UPLOAD_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/pdf'
];

/**
  * GET /api/upload/signed-url?fileName=video.mp4&contentType=video/mp4
  */
export async function GET(req: NextRequest) {
  try {
    // 1. SEC-01: Zero Trust Session Guard
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName') ?? 'upload';
    let contentType = searchParams.get('contentType');

    if (!contentType || contentType === 'application/octet-stream') {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'mp4') contentType = 'video/mp4';
        else if (ext === 'mov') contentType = 'video/quicktime';
        else if (ext === 'pdf') contentType = 'application/pdf';
    }
    if (!contentType) contentType = 'application/octet-stream';


    // 2. SEC-12: Validació de format abans de signar
    if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
        return NextResponse.json({ error: 'Forbidden: Invalid MIME type' }, { status: 415 });
    }
    
    // Sanitize filename: remove spaces and non-standard characters
    const safeName = fileName.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `${uuidv4()}_${safeName}`;

    // 3. Request a signed upload URL (expires in 15 minutes)
    // Passem el contentType per incloure'l a la política de S3 (opcional segons client S3)
    const signedUrl = await getSignedUrl(storagePath, 900, contentType);

    // Calculate public URL based on virtual-hosted style (preferred by AWS)
    const bucket = process.env.S3_BUCKET || 'pxx-core-v1';
    const region = process.env.S3_REGION || 'eu-north-1';
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${storagePath}`;

    return NextResponse.json({
      signedUrl,        // Browser PUTs here directly
      storagePath,      // Used in /api/upload/notify
      publicUrl,        // Final URL stored in DB
    });
  } catch (err: any) {
    console.error('[signed-url] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


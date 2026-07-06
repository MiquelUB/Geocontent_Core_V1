import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultMunicipalityId } from '@/lib/actions/queries';
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

    const municipalityId = await getDefaultMunicipalityId();
    if (!municipalityId) {
        return NextResponse.json({ error: 'TenantID required for cost allocation' }, { status: 403 });
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

    // 3. Proxy a FastAPI (Múscul) per autoritzar la signatura amb Tags
    const fastApiUrl = process.env.INTERNAL_API_URL || 'http://fastapi-core:8000';
    
    const response = await fetch(`${fastApiUrl}/s3/presigned-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-internal-tenant-id': municipalityId,
        },
        body: JSON.stringify({
            filename: storagePath,
            content_type: contentType
        })
    });

    if (!response.ok) {
        console.error('FastAPI error response:', await response.text());
        return NextResponse.json({ error: 'Failed to generate signed URL from Core API' }, { status: 500 });
    }

    const { signedUrl } = await response.json();

    // Calculate public URL based on virtual-hosted style (preferred by AWS)
    const bucket = process.env.S3_BUCKET || 'pxx-core-v1';
    const region = process.env.S3_REGION || 'eu-north-1';
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${storagePath}`;

    const tagging = `TenantID=${municipalityId}&Type=${contentType}`;

    return NextResponse.json({
      signedUrl,        // Browser PUTs here directly
      storagePath,      // Used in /api/upload/notify
      publicUrl,        // Final URL stored in DB
      tagging,
    });
  } catch (err: any) {
    console.error('[signed-url] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


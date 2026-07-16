import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDefaultMunicipalityId } from '@/lib/actions/queries';
import { auth } from '@/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// SEC-12: Whitelist de formats permesos per pujada directa
const ALLOWED_UPLOAD_TYPES = [
    // Images
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
    // Video
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
    'video/x-matroska',
    // Audio (TTS i pujades manuals)
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'audio/x-m4a',
    'audio/flac',
    // Documents
    'application/pdf',
];

/**
  * GET /api/upload/signed-url?fileName=video.mp4&contentType=video/mp4
  *
  * Genera una presigned URL de S3 directament des del servidor Next.js.
  * Les credencials S3 mai arriben al browser (server-side only).
  * El backend Python (api_core) s'usarà exclusivament per a transcodificació i IA.
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

    // 2. Validar configuració S3
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    const endpoint = process.env.S3_ENDPOINT; // Opcional: per a MinIO/R2

    if (!bucket || !region || !accessKey || !secretKey) {
        console.error('[signed-url] S3 credentials not configured. Missing: bucket=%s, region=%s, key=%s', 
            bucket ? 'ok' : 'MISSING',
            region ? 'ok' : 'MISSING',
            accessKey ? 'ok' : 'MISSING'
        );
        return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName') ?? 'upload';
    let contentType = searchParams.get('contentType');

    if (!contentType || contentType === 'application/octet-stream') {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'mp4') contentType = 'video/mp4';
        else if (ext === 'mov') contentType = 'video/quicktime';
        else if (ext === 'webm') contentType = 'video/webm';
        else if (ext === 'mp3') contentType = 'audio/mpeg';
        else if (ext === 'm4a') contentType = 'audio/mp4';
        else if (ext === 'aac') contentType = 'audio/aac';
        else if (ext === 'wav') contentType = 'audio/wav';
        else if (ext === 'ogg') contentType = 'audio/ogg';
        else if (ext === 'flac') contentType = 'audio/flac';
        else if (ext === 'pdf') contentType = 'application/pdf';
    }
    if (!contentType) contentType = 'application/octet-stream';

    // 3. SEC-12: Validació de format abans de signar
    if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
        console.warn(`[signed-url] Rejected MIME type: "${contentType}" for file: "${fileName}"`);
        return NextResponse.json({ error: 'Forbidden: Invalid MIME type' }, { status: 415 });
    }

    // 4. Sanitize filename
    const safeName = fileName.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `${uuidv4()}_${safeName}`;

    // 5. Generar presigned URL via AWS SDK v3 (server-side)
    const s3Config: any = {
        region,
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        },
        // CRÍTIC: Desactivar checksums automàtics (CRC32).
        // AWS SDK v3 afegeix x-amz-checksum-crc32 per defecte al PutObjectCommand.
        // El browser NO pot generar aquest header al fer el PUT directe a la presigned URL → 403.
        requestChecksumCalculation: 'when_required',
        responseChecksumValidation: 'when_required',
    };
    // Suport per a endpoints alternatius (MinIO, Cloudflare R2)
    if (endpoint && !endpoint.includes('amazonaws.com')) {
        s3Config.endpoint = endpoint;
        s3Config.forcePathStyle = true;
    }

    const s3Client = new S3Client(s3Config);

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: storagePath,
        ContentType: contentType,
        Tagging: `TenantID=${municipalityId}&Type=${encodeURIComponent(contentType)}`,
    });

    // URL vàlida durant 15 minuts
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // 6. URL pública final (via CloudFront si NEXT_PUBLIC_STORAGE_URL és CloudFront)
    const storageBase = process.env.NEXT_PUBLIC_STORAGE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
    // CloudFront URL no inclou el bucket al path; S3 directe sí
    const isCloudFront = storageBase.includes('cloudfront.net');
    const publicUrl = isCloudFront
        ? `${storageBase}/${storagePath}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${storagePath}`;

    const tagging = `TenantID=${municipalityId}&Type=${contentType}`;

    return NextResponse.json({
      signedUrl,        // Browser PUTs aquí directament
      storagePath,      // Usat a /api/upload/notify
      publicUrl,        // URL final guardada a la BD
      tagging,
    });

  } catch (err: any) {
    console.error('[signed-url] Unexpected error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

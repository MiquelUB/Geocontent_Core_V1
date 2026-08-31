import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getS3Client() {
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
  const region = process.env.S3_REGION || 'eu-north-1';
  const endpoint = process.env.S3_ENDPOINT;

  const config: any = {
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  };
  if (endpoint && !endpoint.includes('amazonaws.com')) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }
  return new S3Client(config);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let bucket = process.env.S3_BUCKET || 'pxx-core-v1';
  let key = url;

  if (url.startsWith('http')) {
    try {
      const u = new URL(url);
      key = decodeURIComponent(u.pathname.replace(/^\//, ''));
      if (u.hostname.includes('.s3.') || u.hostname.includes('.s3-')) {
        const hostBucket = u.hostname.split('.')[0];
        if (hostBucket && hostBucket !== 's3') {
          bucket = hostBucket;
        }
      }
    } catch {
      key = url;
    }
  }

  try {
    const s3Client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // Generem una URL presignada vàlida per 1 hora.
    // Això permet al navegador anar directament a S3, evitant que el vídeo 
    // passi pel contenidor Next.js (estalviant CPU, RAM i ample de banda).
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.redirect(signedUrl);
  } catch (err: any) {
    console.error('[media-proxy presign error]:', err);
    return NextResponse.json(
      { 
        error: err.message || 'Error generating presigned URL',
        name: err.name,
        code: err.Code || err.code || err.$metadata?.httpStatusCode,
        bucket,
        key
      }, 
      { status: 500 }
    );
  }
}

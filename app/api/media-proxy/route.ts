import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
const region = process.env.S3_REGION || 'eu-north-1';

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  },
});

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
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

  const range = req.headers.get('range');

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range || undefined,
    });

    const s3Response = await s3Client.send(command);

    const headers = new Headers();
    if (s3Response.ContentType) {
      headers.set('Content-Type', s3Response.ContentType);
    } else if (key.endsWith('.mp4')) {
      headers.set('Content-Type', 'video/mp4');
    } else if (key.endsWith('.mp3')) {
      headers.set('Content-Type', 'audio/mpeg');
    }

    if (s3Response.ContentLength) {
      headers.set('Content-Length', s3Response.ContentLength.toString());
    }
    if (s3Response.ContentRange) {
      headers.set('Content-Range', s3Response.ContentRange);
    }
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    const status = range ? 206 : 200;
    const body = s3Response.Body ? (s3Response.Body as any).transformToWebStream() : null;

    return new NextResponse(body, {
      status,
      headers,
    });
  } catch (err: any) {
    console.error('[media-proxy error]:', err);
    return new NextResponse('Error streaming media', { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

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

  const s3Client = getS3Client();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // 1. Generate a presigned GET URL (valid for 1 hour)
    // S3 natively handles HTTP 206 Partial Content, video scrubbing, and caching
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Redirect browser directly to authorized S3 stream
    return NextResponse.redirect(signedUrl, 307);
  } catch (err: any) {
    console.error('[media-proxy presign error, falling back to direct stream]:', err);
    
    try {
      const range = req.headers.get('range');
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

      let webStream: any = s3Response.Body;
      if (s3Response.Body) {
        if (typeof (s3Response.Body as any).transformToWebStream === 'function') {
          webStream = (s3Response.Body as any).transformToWebStream();
        } else if (s3Response.Body instanceof Readable || (s3Response.Body as any).pipe) {
          webStream = Readable.toWeb(s3Response.Body as any);
        }
      }

      const status = range ? 206 : 200;
      return new NextResponse(webStream, {
        status,
        headers,
      });
    } catch (streamErr: any) {
      console.error('[media-proxy stream error]:', streamErr);
      return new NextResponse('Error streaming media', { status: 500 });
    }
  }
}

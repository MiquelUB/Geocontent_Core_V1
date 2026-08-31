import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

function nodeStreamToWebStream(nodeStream: any): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: any) => {
        controller.enqueue(chunk);
      });
      nodeStream.on('end', () => {
        controller.close();
      });
      nodeStream.on('error', (err: any) => {
        controller.error(err);
      });
    },
    cancel() {
      try {
        nodeStream.destroy?.();
      } catch {}
    }
  });
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

  const s3Client = getS3Client();
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

    let webStream: ReadableStream;
    if (s3Response.Body && typeof (s3Response.Body as any).transformToWebStream === 'function') {
      try {
        webStream = (s3Response.Body as any).transformToWebStream();
      } catch {
        webStream = nodeStreamToWebStream(s3Response.Body);
      }
    } else if (s3Response.Body) {
      webStream = nodeStreamToWebStream(s3Response.Body);
    } else {
      return NextResponse.json({ error: 'Empty S3 response body' }, { status: 404 });
    }

    const status = range ? 206 : 200;
    return new NextResponse(webStream, {
      status,
      headers,
    });
  } catch (err: any) {
    console.error('[media-proxy stream error]:', err);
    return NextResponse.json(
      { 
        error: err.message || 'Error streaming media',
        name: err.name,
        code: err.Code || err.code || err.$metadata?.httpStatusCode,
        bucket,
        key
      }, 
      { status: 500 }
    );
  }
}

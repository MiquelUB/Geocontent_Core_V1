import { NextRequest, NextResponse } from 'next/server';
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(req: NextRequest) {
  const diag: any = {};

  // 1. Check env vars
  diag.envVars = {
    S3_BUCKET: process.env.S3_BUCKET || '(not set, default pxx-core-v1)',
    S3_REGION: process.env.S3_REGION || '(not set, default eu-north-1)',
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ? 'SET (' + (process.env.S3_ACCESS_KEY).substring(0,5) + '...)' : 'NOT SET',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET (' + (process.env.AWS_ACCESS_KEY_ID).substring(0,5) + '...)' : 'NOT SET',
    S3_SECRET_KEY: process.env.S3_SECRET_KEY ? 'SET (length ' + (process.env.S3_SECRET_KEY).length + ')' : 'NOT SET',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET (length ' + (process.env.AWS_SECRET_ACCESS_KEY).length + ')' : 'NOT SET',
    S3_ENDPOINT: process.env.S3_ENDPOINT || '(not set)',
  };

  const bucket = process.env.S3_BUCKET || 'pxx-core-v1';
  const region = process.env.S3_REGION || 'eu-north-1';
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

  if (!accessKey || !secretKey) {
    diag.error = 'NO CREDENTIALS AVAILABLE';
    return NextResponse.json(diag, { status: 500 });
  }

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });

  // 2. Try listing the video folder
  const prefix = 'media/pois/98eab764-2cdc-4af5-bc6a-70e8f38b70ec/video/';
  try {
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 10,
    }));
    diag.listObjects = {
      bucket,
      prefix,
      count: listResult.KeyCount,
      files: (listResult.Contents || []).map(c => ({
        key: c.Key,
        size: c.Size,
        lastModified: c.LastModified?.toISOString(),
      })),
    };
  } catch (err: any) {
    diag.listError = { message: err.message, name: err.name, code: err.Code || err.$metadata?.httpStatusCode };
  }

  // 3. Try HeadObject on es.mp4
  const testKey = 'media/pois/98eab764-2cdc-4af5-bc6a-70e8f38b70ec/video/es.mp4';
  try {
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    diag.headObject = {
      key: testKey,
      contentType: headResult.ContentType,
      contentLength: headResult.ContentLength,
      lastModified: headResult.LastModified?.toISOString(),
    };
  } catch (err: any) {
    diag.headError = { message: err.message, name: err.name, code: err.Code || err.$metadata?.httpStatusCode };
  }

  return NextResponse.json(diag, { status: 200 });
}

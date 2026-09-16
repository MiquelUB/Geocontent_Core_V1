import { NextRequest, NextResponse } from 'next/server';
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(req: NextRequest) {
  const diag: any = {};
  const url = new URL(req.url);
  const bucketParam = url.searchParams.get('bucket');

  const bucket = bucketParam || process.env.S3_BUCKET || 'pxx-core-vox-v1';
  const region = process.env.S3_REGION || 'eu-north-1';
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });

  const prefix = 'media/pois/98eab764-2cdc-4af5-bc6a-70e8f38b70ec/video/';
  try {
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    }));
    diag.listObjects = listResult.Contents?.map(c => c.Key) || [];
  } catch (err: any) {
    diag.listError = err.message;
  }

  const testKey = 'media/pois/98eab764-2cdc-4af5-bc6a-70e8f38b70ec/video/en.mp4';
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    diag.headEn = 'Exists';
  } catch (err: any) {
    diag.headEnError = err.message;
  }

  return NextResponse.json(diag);
}

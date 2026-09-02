'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/database/prisma';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { rateLimit } from '@/lib/services/ratelimit';

function getS3Client(): S3Client {
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
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

function getBucketName(): string {
  return process.env.S3_BUCKET || process.env.R2_BUCKET_NAME || 'pxx-core-vox-v1';
}

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const role = (session.user as any).role;
  if (role === 'SUPER_ADMIN' || session.user.email === 'mistic_master') {
    // Permès directament per rol a la sessió
  } else {
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (dbUser?.role !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Requires Super Admin privileges');
    }
  }

  // Rate Limiting (1 request per 10 segons)
  const isAllowed = await rateLimit(`s3-maintenance:${session.user.id}`, 1, 10);
  if (!isAllowed) {
    throw new Error('Massa peticions. Si us plau, espera una mica.');
  }

  return true;
}

// Function to extract all active URLs from the database (Whitelist)
async function getActiveUrlsWhitelist(): Promise<Set<string>> {
  const whitelist = new Set<string>();
  const bucket = getBucketName();

  // Helper to safely add URLs to whitelist
  const add = (url: string | null | undefined) => {
    if (!url || typeof url !== 'string') return;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/^\/+/, ''); // Remove leading slashes
        whitelist.add(decodeURIComponent(path));
        whitelist.add(path);
        // If path has subfolders like /pxx-core-vox-v1/key (path style):
        if (path.startsWith(bucket + '/')) {
          const sub = path.substring(bucket.length + 1);
          whitelist.add(decodeURIComponent(sub));
          whitelist.add(sub);
        }
      } else {
        const clean = url.replace(/^\/+/, '');
        whitelist.add(decodeURIComponent(clean));
        whitelist.add(clean);
      }
    } catch {
      const clean = url.replace(/^\/+/, '');
      whitelist.add(decodeURIComponent(clean));
      whitelist.add(clean);
    }
  };

  // 1. Users
  const users = await prisma.user.findMany({ select: { image: true, avatarUrl: true } });
  users.forEach(u => { add(u.image); add(u.avatarUrl); });

  // 2. Municipalities
  const munis = await prisma.municipality.findMany({ select: { logoUrl: true } });
  munis.forEach(m => add(m.logoUrl));

  // 3. Routes
  const routes = await prisma.route.findMany({ select: { thumbnail1x1: true, header16x9: true, audioTranslations: true } });
  routes.forEach((r: any) => {
    add(r.thumbnail1x1);
    add(r.header16x9);
    if (r.audioTranslations && typeof r.audioTranslations === 'object') {
      Object.values(r.audioTranslations).forEach((val: any) => typeof val === 'string' && add(val));
    }
  });

  // 4. POIs
  const pois = await prisma.poi.findMany({ 
    select: { 
      audioUrl: true, 
      videoUrls: true, 
      appThumbnail: true, 
      header16x9: true, 
      carouselImages: true,
      audioTranslations: true,
      videoTranslations: true
    } 
  });
  pois.forEach((p: any) => {
    add(p.audioUrl);
    add(p.appThumbnail);
    add(p.header16x9);
    if (Array.isArray(p.videoUrls)) p.videoUrls.forEach((v: string) => add(v));
    if (Array.isArray(p.carouselImages)) p.carouselImages.forEach((c: string) => add(c));
    if (p.audioTranslations && typeof p.audioTranslations === 'object') {
      Object.values(p.audioTranslations).forEach((val: any) => typeof val === 'string' && add(val));
    }
    if (p.videoTranslations && typeof p.videoTranslations === 'object') {
      Object.values(p.videoTranslations).forEach((val: any) => typeof val === 'string' && add(val));
    }
  });

  return whitelist;
}

export async function analyzeS3Orphans() {
  try {
    await requireSuperAdmin();

    const bucket = getBucketName();
    const s3 = getS3Client();
    const whitelist = await getActiveUrlsWhitelist();
    const orphans: { key: string, size: number }[] = [];
    let totalSize = 0;

    let continuationToken: string | undefined = undefined;
    
    do {
      const cmd = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      });
      const response = await s3.send(cmd) as any;
      
      if (response.Contents) {
        for (const item of response.Contents) {
          if (!item.Key) continue;
          
          // Skip directory placeholders
          if (item.Key.endsWith('/') || item.Size === 0) continue;

          if (!whitelist.has(item.Key) && !whitelist.has(decodeURIComponent(item.Key))) {
            orphans.push({ key: item.Key, size: item.Size || 0 });
            totalSize += (item.Size || 0);
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      success: true,
      count: orphans.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      orphans,
    };

  } catch (error: any) {
    console.error('analyzeS3Orphans Error:', error);
    return { success: false, error: error.message };
  }
}

export async function cleanS3Orphans(orphanKeys: string[]) {
  try {
    await requireSuperAdmin();
    
    if (!orphanKeys || orphanKeys.length === 0) {
      return { success: true, deleted: 0 };
    }

    const bucket = getBucketName();
    const s3 = getS3Client();

    // Double-check against whitelist just before deleting to prevent race conditions
    const whitelist = await getActiveUrlsWhitelist();
    const safeToDelete = orphanKeys.filter(key => !whitelist.has(key) && !whitelist.has(decodeURIComponent(key)));

    if (safeToDelete.length === 0) {
      return { success: true, deleted: 0 };
    }

    // S3 DeleteObjects allows max 1000 keys per request
    // Chunking in 500 for safety
    const chunkSize = 500;
    let totalDeleted = 0;

    for (let i = 0; i < safeToDelete.length; i += chunkSize) {
      const chunk = safeToDelete.slice(i, i + chunkSize);
      
      const cmd = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map(key => ({ Key: key })),
          Quiet: false,
        }
      });

      const res = await s3.send(cmd);
      totalDeleted += (res.Deleted?.length || 0);
    }

    return {
      success: true,
      deleted: totalDeleted,
    };

  } catch (error: any) {
    console.error('cleanS3Orphans Error:', error);
    return { success: false, error: error.message };
  }
}

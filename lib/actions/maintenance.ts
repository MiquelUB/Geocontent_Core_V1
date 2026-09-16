'use server';

import { auth } from '@/auth';
import prisma from '@/lib/database/prisma';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { rateLimit } from '@/lib/services/ratelimit';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  // Must be SUPER_ADMIN
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (dbUser?.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Requires Super Admin privileges');
  }

  // Rate Limiting (1 request per 30 seconds for heavy ops)
  const isAllowed = await rateLimit(`s3-maintenance:${session.user.id}`, 1, 30);
  if (!isAllowed) {
    throw new Error('Massa peticions. Si us plau, espera una mica.');
  }

  return true;
}

// Function to extract all active URLs from the database (Whitelist)
async function getActiveUrlsWhitelist(): Promise<Set<string>> {
  const whitelist = new Set<string>();

  // Helper to safely add URLs to whitelist
  const add = (url: string | null | undefined) => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.substring(1); // Remove leading slash
      whitelist.add(path);
    } catch {
      // If it's a relative path (unlikely, but safe)
      if (url.startsWith('/')) {
        whitelist.add(url.substring(1));
      } else {
        whitelist.add(url);
      }
    }
  };

  // 1. Users
  const users = await prisma.user.findMany({ select: { image: true, avatarUrl: true } });
  users.forEach(u => { add(u.image); add(u.avatarUrl); });

  // 2. Municipalities
  const munis = await prisma.municipality.findMany({ select: { logoUrl: true } });
  munis.forEach(m => add(m.logoUrl));

  // 3. Routes
  const routes = await prisma.route.findMany({ select: { thumbnail1x1: true, header16x9: true } });
  routes.forEach(r => { add(r.thumbnail1x1); add(r.header16x9); });

  // 4. POIs
  const pois = await prisma.poi.findMany({ 
    select: { audioUrl: true, videoUrls: true, appThumbnail: true, header16x9: true, carouselImages: true } 
  });
  pois.forEach((p: any) => {
    add(p.audioUrl);
    add(p.appThumbnail);
    add(p.header16x9);
    p.videoUrls.forEach((v: string) => add(v));
    p.carouselImages.forEach((c: string) => add(c));
  });

  return whitelist;
}

export async function analyzeS3Orphans() {
  try {
    await requireSuperAdmin();

    const whitelist = await getActiveUrlsWhitelist();
    const orphans: { key: string, size: number }[] = [];
    let totalSize = 0;

    let continuationToken: string | undefined = undefined;
    
    do {
      const cmd = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
      });
      const response = await s3.send(cmd) as any;
      
      if (response.Contents) {
        for (const item of response.Contents) {
          if (!item.Key) continue;
          
          // Only check folders managed by our uploads
          if (item.Key.startsWith('geocontent/') || item.Key.startsWith('avatars/') || item.Key.startsWith('videos/')) {
            if (!whitelist.has(item.Key)) {
              orphans.push({ key: item.Key, size: item.Size || 0 });
              totalSize += (item.Size || 0);
            }
          }
        }
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      success: true,
      count: orphans.length,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      orphans, // Returning full list for the UI to display or store
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

    // Double-check against whitelist just before deleting to prevent race conditions
    const whitelist = await getActiveUrlsWhitelist();
    const safeToDelete = orphanKeys.filter(key => !whitelist.has(key));

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
        Bucket: R2_BUCKET_NAME,
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

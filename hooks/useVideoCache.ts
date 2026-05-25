'use client';

import { useState, useCallback } from 'react';

const CACHE_NAME = 'geocontent-video-cache';
const MAX_CACHE_BYTES = 35 * 1024 * 1024; // 35MB budget

interface VideoCacheEntry {
  url: string;
  sizeBytes: number;
  cachedAt: number;
}

interface VideoCacheState {
  /** Whether the Cache API is available in this browser */
  isSupported: boolean;
  /** Total bytes currently cached */
  totalCachedBytes: number;
}

/**
 * Hook that manages local video caching via the Cache API.
 * Provides methods to cache, retrieve, and evict videos
 * with a fixed storage budget.
 */
export function useVideoCache() {
  const [state, setState] = useState<VideoCacheState>({
    isSupported: typeof caches !== 'undefined',
    totalCachedBytes: 0,
  });

  /**
   * Check if a video URL is already cached locally.
   */
  const isCached = useCallback(async (url: string): Promise<boolean> => {
    if (typeof caches === 'undefined') return false;
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(url);
      return !!match;
    } catch {
      return false;
    }
  }, []);

  /**
   * Get a blob URL for a cached video, or null if not cached.
   */
  const getCachedVideoUrl = useCallback(async (url: string): Promise<string | null> => {
    if (typeof caches === 'undefined') return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(url);
      if (!response) return null;
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, []);

  /**
   * Get the manifest of all cached entries from a metadata key.
   */
  const getManifest = useCallback(async (): Promise<VideoCacheEntry[]> => {
    if (typeof caches === 'undefined') return [];
    try {
      const cache = await caches.open(CACHE_NAME);
      const manifestResp = await cache.match('__manifest__');
      if (!manifestResp) return [];
      return await manifestResp.json();
    } catch {
      return [];
    }
  }, []);

  /**
   * Save the manifest back to the cache.
   */
  const saveManifest = useCallback(async (entries: VideoCacheEntry[]) => {
    if (typeof caches === 'undefined') return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        '__manifest__',
        new Response(JSON.stringify(entries), {
          headers: { 'Content-Type': 'application/json' },
        })
      );
    } catch { /* silent */ }
  }, []);

  /**
   * Cache a video from a remote URL. Enforces the 35MB budget
   * by evicting oldest entries if needed.
   */
  const cacheVideo = useCallback(async (url: string): Promise<boolean> => {
    if (typeof caches === 'undefined') return false;
    try {
      // Skip if already cached
      const already = await isCached(url);
      if (already) return true;

      const response = await fetch(url);
      if (!response.ok) return false;

      const blob = await response.blob();
      const sizeBytes = blob.size;

      // Enforce budget — evict oldest if necessary
      let manifest = await getManifest();
      let currentTotal = manifest.reduce((sum, e) => sum + e.sizeBytes, 0);

      while (currentTotal + sizeBytes > MAX_CACHE_BYTES && manifest.length > 0) {
        const oldest = manifest.shift()!;
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(oldest.url);
        currentTotal -= oldest.sizeBytes;
      }

      // If single file exceeds budget, don't cache it
      if (sizeBytes > MAX_CACHE_BYTES) {
        console.warn(`[VideoCache] File too large to cache: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB`);
        return false;
      }

      // Store the video
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, new Response(blob));

      // Update manifest
      manifest.push({ url, sizeBytes, cachedAt: Date.now() });
      await saveManifest(manifest);

      setState({
        isSupported: true,
        totalCachedBytes: currentTotal + sizeBytes,
      });

      return true;
    } catch (err) {
      console.error('[VideoCache] Failed to cache video:', err);
      return false;
    }
  }, [isCached, getManifest, saveManifest]);

  /**
   * Clear all cached videos.
   */
  const clearCache = useCallback(async () => {
    if (typeof caches === 'undefined') return;
    try {
      await caches.delete(CACHE_NAME);
      setState({ isSupported: true, totalCachedBytes: 0 });
    } catch { /* silent */ }
  }, []);

  return {
    ...state,
    isCached,
    getCachedVideoUrl,
    cacheVideo,
    clearCache,
  };
}

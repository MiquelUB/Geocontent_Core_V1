/**
 * lib/services/sync-service.ts
 *
 * Territorial Package Sync Service — Protocol Sobirania PXX
 *
 * Gestiona la descàrrega i cache de "Paquets Territorials":
 *   - JSON de rutes i POIs (dades estructurades)
 *   - Àudios Snack (<30s, MP4 480p) per a reproducció offline
 *   - Tiles del mapa (CartoDB Positron) per a l'àrea d'interès
 *
 * Utilitza la Cache API del navegador (disponible offline via Service Worker).
 * Compatible amb next-pwa / Workbox.
 */

export interface TerritorialPackage {
  routeId: string;
  routeName: string;
  /** Fecha de la última sincronización */
  lastSynced: string | null;
  /** Bytes totals descarregats */
  totalBytes: number;
  /** Estat del paquet */
  status: 'pending' | 'downloading' | 'ready' | 'error';
}

export interface SyncProgress {
  phase: 'routes' | 'audio' | 'tiles';
  current: number;
  total: number;
  label: string;
}

const CACHE_NAME = 'pxx-territorial-v1';
const ROUTES_CACHE = 'pxx-routes-v1';
const AUDIO_CACHE = 'pxx-audio-v1';
const TILES_CACHE = 'pxx-tiles-v1';

// CartoDB Positron tile base URLs for offline caching
const TILE_PROVIDERS = [
  'https://a.basemaps.cartocdn.com/gl/positron-gl-style',
  'https://b.basemaps.cartocdn.com/gl/positron-gl-style',
  'https://c.basemaps.cartocdn.com/gl/positron-gl-style',
];

/**
 * Checks if the Cache API is available (browser + service worker context).
 */
function isCacheAvailable(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Downloads and caches the JSON data for a specific route and its POIs.
 * This is the "Snack" of the Territorial Package — fast, lightweight.
 */
export async function cacheRouteData(
  routeId: string,
  onProgress?: (p: SyncProgress) => void
): Promise<void> {
  if (!isCacheAvailable()) return;

  onProgress?.({ phase: 'routes', current: 0, total: 1, label: 'Descarregant dades de la ruta…' });

  const cache = await caches.open(ROUTES_CACHE);
  const url = `/api/routes/${routeId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await cache.put(url, response.clone());
    onProgress?.({ phase: 'routes', current: 1, total: 1, label: 'Dades de ruta guardades ✅' });
  } catch (err) {
    console.warn(`[SyncService] Could not cache route ${routeId}:`, err);
  }
}

/**
 * Downloads and caches Snack audio files for all POIs in a route.
 * Snack = àudio curt < 30s, format MP4 480p.
 */
export async function cacheRouteAudio(
  pois: Array<{ id: string; audioUrl?: string | null }>,
  onProgress?: (p: SyncProgress) => void
): Promise<void> {
  if (!isCacheAvailable()) return;

  const withAudio = pois.filter(p => p.audioUrl);
  if (withAudio.length === 0) return;

  const cache = await caches.open(AUDIO_CACHE);

  for (let i = 0; i < withAudio.length; i++) {
    const poi = withAudio[i];
    onProgress?.({
      phase: 'audio',
      current: i,
      total: withAudio.length,
      label: `Descarregant àudio ${i + 1}/${withAudio.length}…`,
    });

    try {
      const cached = await cache.match(poi.audioUrl!);
      if (!cached) {
        const response = await fetch(poi.audioUrl!);
        if (response.ok) await cache.put(poi.audioUrl!, response.clone());
      }
    } catch (err) {
      console.warn(`[SyncService] Could not cache audio for POI ${poi.id}:`, err);
    }
  }

  onProgress?.({
    phase: 'audio',
    current: withAudio.length,
    total: withAudio.length,
    label: 'Àudios guardats ✅',
  });
}

/**
 * Pre-caches map tiles for a bounding box at zoom levels 10-14.
 * Zone: lat/lng bounding box around the route.
 *
 * IMPORTANT: Only caches a limited tile grid to avoid excessive storage.
 * Per Directiva: formats comprimits (CartoDB Positron = vector, ~1KB/tile).
 */
export async function cacheMapTiles(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  onProgress?: (p: SyncProgress) => void
): Promise<void> {
  if (!isCacheAvailable()) return;

  const cache = await caches.open(TILES_CACHE);
  const zoomLevels = [10, 11, 12, 13, 14]; // Prou detall per senderisme
  const tileUrls: string[] = [];

  for (const zoom of zoomLevels) {
    const tiles = getTilesForBounds(bounds, zoom);
    for (const { x, y } of tiles) {
      // Use CartoDB Positron (sovereign, no API key)
      tileUrls.push(`${TILE_PROVIDERS[0]}/${zoom}/${x}/${y}.png`);
    }
  }

  // Limit: max 500 tiles per paquet territorial (~500KB)
  const limited = tileUrls.slice(0, 500);

  for (let i = 0; i < limited.length; i++) {
    if (i % 50 === 0) {
      onProgress?.({
        phase: 'tiles',
        current: i,
        total: limited.length,
        label: `Tiles del mapa ${i}/${limited.length}…`,
      });
    }

    try {
      const cached = await cache.match(limited[i]);
      if (!cached) {
        const res = await fetch(limited[i]);
        if (res.ok) await cache.put(limited[i], res.clone());
      }
    } catch {
      // Non-fatal: single tile failure
    }
  }

  onProgress?.({ phase: 'tiles', current: limited.length, total: limited.length, label: 'Tiles guardats ✅' });
}

/**
 * Full Territorial Package download for a route.
 * Called from the "Punt d'Or" UI before starting a route.
 */
export async function downloadTerritorialPackage(
  routeId: string,
  pois: Array<{ id: string; audioUrl?: string | null; latitude?: number; longitude?: number }>,
  onProgress?: (p: SyncProgress) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Route JSON
    await cacheRouteData(routeId, onProgress);

    // Step 2: Audio Snacks
    await cacheRouteAudio(pois, onProgress);

    // Step 3: Map tiles (bounding box around POIs)
    if (pois.length > 0) {
      const lats = pois.filter(p => p.latitude).map(p => p.latitude!);
      const lngs = pois.filter(p => p.longitude).map(p => p.longitude!);
      if (lats.length > 0) {
        const padding = 0.05; // ~5km padding
        await cacheMapTiles({
          minLat: Math.min(...lats) - padding,
          maxLat: Math.max(...lats) + padding,
          minLng: Math.min(...lngs) - padding,
          maxLng: Math.max(...lngs) + padding,
        }, onProgress);
      }
    }

    // Persist package metadata to localStorage
    const meta: TerritorialPackage = {
      routeId,
      routeName: routeId,
      lastSynced: new Date().toISOString(),
      totalBytes: 0,
      status: 'ready',
    };
    const existing = getCachedPackages();
    const updated = existing.filter(p => p.routeId !== routeId);
    localStorage.setItem('pxx-territorial-packages', JSON.stringify([...updated, meta]));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Returns the list of locally cached territorial packages.
 */
export function getCachedPackages(): TerritorialPackage[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('pxx-territorial-packages') ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Checks if a route is already cached (ready for offline).
 */
export function isRouteCached(routeId: string): boolean {
  return getCachedPackages().some(p => p.routeId === routeId && p.status === 'ready');
}

/**
 * Removes a territorial package from cache.
 */
export async function evictTerritorialPackage(routeId: string): Promise<void> {
  const existing = getCachedPackages().filter(p => p.routeId !== routeId);
  localStorage.setItem('pxx-territorial-packages', JSON.stringify(existing));
  // Note: actual cache eviction requires SW message passing or cache.delete() with known keys
}

// ──────────────────────────────────────────────────────────────────────────────
// Tile math helpers (Slippy Map / Web Mercator)
// ──────────────────────────────────────────────────────────────────────────────
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function getTilesForBounds(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  zoom: number
): Array<{ x: number; y: number }> {
  const topLeft = latLngToTile(bounds.maxLat, bounds.minLng, zoom);
  const bottomRight = latLngToTile(bounds.minLat, bounds.maxLng, zoom);
  const tiles: Array<{ x: number; y: number }> = [];

  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * ============================================================================
 * SPATIAL-TEMPORAL WEATHER CACHING & LANE BATCHING
 * ============================================================================
 * Caches Open-Meteo atmospheric & marine series keyed by spatial 0.25° grid 
 * cells and 6-hour model run epoch boundaries, enabling massive performance 
 * gains across active fleet lane corridors.
 */

import { fetchHourlyWeatherSeries, HourlyWeatherSeries } from "./weather-ingestion";

const CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 Hours TTL (under 6h NWP cycle)
const GRID_PRECISION_DEG = 0.25; // 0.25° grid resolution matches ECMWF/GFS native mesh

interface CacheEntry {
  series: HourlyWeatherSeries;
  cachedAt: number;
}

const memoryGridCache = new Map<string, CacheEntry>();

/**
 * Computes spatial-temporal cache key for a given coordinate and 6-hour run bucket.
 */
export function generateGridCacheKey(lat: number, lng: number, timestampMs: number = Date.now()): string {
  const roundedLat = (Math.round(lat / GRID_PRECISION_DEG) * GRID_PRECISION_DEG).toFixed(2);
  const roundedLng = (Math.round(lng / GRID_PRECISION_DEG) * GRID_PRECISION_DEG).toFixed(2);
  // Round to nearest 6-hour model cycle epoch boundary
  const runBucket = Math.floor(timestampMs / (6 * 3600_000)) * (6 * 3600_000);
  return `weather_grid:${roundedLat}:${roundedLng}:${runBucket}`;
}

/**
 * Fetches or retrieves weather series from spatial-temporal cache.
 */
export async function fetchWeatherSeriesCached(
  lat: number,
  lng: number,
  timestampMs: number = Date.now()
): Promise<HourlyWeatherSeries> {
  const key = generateGridCacheKey(lat, lng, timestampMs);
  const now = Date.now();
  const cached = memoryGridCache.get(key);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.series;
  }

  const series = await fetchHourlyWeatherSeries(lat, lng);
  memoryGridCache.set(key, { series, cachedAt: now });
  return series;
}

/**
 * Clears expired entries from the spatial grid cache.
 */
export function purgeExpiredWeatherCache(): number {
  const now = Date.now();
  let purged = 0;
  for (const [key, entry] of memoryGridCache.entries()) {
    if (now - entry.cachedAt >= CACHE_TTL_MS) {
      memoryGridCache.delete(key);
      purged++;
    }
  }
  return purged;
}

export function getCacheStats() {
  return {
    totalEntries: memoryGridCache.size,
    gridPrecisionDeg: GRID_PRECISION_DEG,
    ttlHours: CACHE_TTL_MS / 3600_000,
  };
}

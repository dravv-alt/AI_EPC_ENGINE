/**
 * ============================================================================
 * UNIFIED WEATHER INGESTION PIPELINE (ATMOSPHERIC & MARINE INTEGRATION)
 * ============================================================================
 * Queries Open-Meteo Atmospheric & Marine APIs, merges them into hourly time 
 * series, performs binary-search & circular angular interpolation at exact ETA 
 * timestamps, and tags forecast horizon metrics.
 */

export interface HourlyWeatherSeries {
  times: number[];               // Unix epoch milliseconds, sorted ascending
  windSpeedMs: number[];
  windDirectionDeg: number[];    // Direction FROM [0, 360)
  precipitationMmH: number[];
  weatherCode: number[];         // WMO weather code (0 - 99)
  waveHeightM: number[];         // Significant wave height (Hs)
  waveDirectionDeg: number[];    // Peak wave/swell direction FROM [0, 360)
  swellHeightM: number[];
  visibilityM: number[];         // Optical surface visibility (meters)
  forecastRunTime: number;       // Unix epoch ms when model was generated
}

export interface InterpolatedWeather {
  windSpeedMs: number;
  windSpeedKnots: number;
  windFromDeg: number;
  precipitationMmH: number;
  weatherCode: number;
  waveHeightM: number;
  waveFromDeg: number;
  swellHeightM: number;
  visibilityM: number;
  forecastHorizonHours: number;
  isClimatologicalFallback: boolean;
}

const FORECAST_HORIZON_LIMIT_HOURS = 16 * 24; // 16 Days maximum for high-resolution NWP
const MS_TO_KNOTS = 1.943844;

/**
 * Binary search to find the bracketing index pair [lo, hi] for targetTime.
 */
export function bracketIndices(times: number[], targetTime: number): [number, number] {
  if (times.length === 0) return [0, 0];
  if (targetTime <= times[0]) return [0, 0];
  const last = times.length - 1;
  if (targetTime >= times[last]) return [last, last];

  let lo = 0;
  let hi = last;

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= targetTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return [lo, hi];
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/**
 * Circular interpolation for angular directions [0, 360) preventing wrap glitches at 0/360 boundary.
 */
export function lerpAngle(a: number, b: number, f: number): number {
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return ((a + diff * f + 360) % 360);
}

/**
 * Interpolates weather variables at exact point-in-time timestamp.
 */
export function interpolateAtTime(
  series: HourlyWeatherSeries,
  targetTime: Date
): InterpolatedWeather {
  const t = targetTime.getTime();
  const horizonHours = Number(((t - series.forecastRunTime) / 3_600_000).toFixed(1));

  // If query is past the 16-day forecast envelope, use climatological fallback
  if (horizonHours > FORECAST_HORIZON_LIMIT_HOURS || series.times.length === 0) {
    return climatologicalFallback(targetTime, horizonHours);
  }

  const [i, j] = bracketIndices(series.times, t);
  const f = i === j ? 0 : (t - series.times[i]) / Math.max(1, series.times[j] - series.times[i]);

  const windSpeedMs = Number(lerp(series.windSpeedMs[i] ?? 5.0, series.windSpeedMs[j] ?? 5.0, f).toFixed(2));
  const windFromDeg = Number(lerpAngle(series.windDirectionDeg[i] ?? 0, series.windDirectionDeg[j] ?? 0, f).toFixed(1));
  const precipitationMmH = Number(lerp(series.precipitationMmH[i] ?? 0, series.precipitationMmH[j] ?? 0, f).toFixed(2));
  
  // Categorical WMO weather code snaps to the closest bracketing hourly sample
  const weatherCode = f < 0.5 ? series.weatherCode[i] ?? 0 : series.weatherCode[j] ?? 0;

  const waveHeightM = Number(lerp(series.waveHeightM[i] ?? 1.2, series.waveHeightM[j] ?? 1.2, f).toFixed(2));
  const waveFromDeg = Number(lerpAngle(series.waveDirectionDeg[i] ?? 0, series.waveDirectionDeg[j] ?? 0, f).toFixed(1));
  const swellHeightM = Number(lerp(series.swellHeightM[i] ?? 0.8, series.swellHeightM[j] ?? 0.8, f).toFixed(2));
  const visibilityM = Number(lerp(series.visibilityM[i] ?? 10000, series.visibilityM[j] ?? 10000, f).toFixed(0));

  return {
    windSpeedMs,
    windSpeedKnots: Number((windSpeedMs * MS_TO_KNOTS).toFixed(1)),
    windFromDeg,
    precipitationMmH,
    weatherCode,
    waveHeightM,
    waveFromDeg,
    swellHeightM,
    visibilityM,
    forecastHorizonHours: horizonHours,
    isClimatologicalFallback: false,
  };
}

/**
 * Climatological fallback for ETAs beyond high-resolution forecast envelope.
 */
export function climatologicalFallback(
  targetTime: Date,
  horizonHours: number
): InterpolatedWeather {
  const month = targetTime.getUTCMonth(); // 0-11
  // Tropical monsoon & storm season variance
  const isSummerMonsoon = month >= 5 && month <= 8;

  const windSpeedMs = isSummerMonsoon ? 8.5 : 5.5;
  const waveHeightM = isSummerMonsoon ? 2.2 : 1.2;

  return {
    windSpeedMs,
    windSpeedKnots: Number((windSpeedMs * MS_TO_KNOTS).toFixed(1)),
    windFromDeg: 240, // Prevailing SW monsoon default
    precipitationMmH: isSummerMonsoon ? 1.5 : 0.0,
    weatherCode: isSummerMonsoon ? 2 : 0,
    waveHeightM,
    waveFromDeg: 240,
    swellHeightM: isSummerMonsoon ? 1.6 : 0.8,
    visibilityM: 10000,
    forecastHorizonHours: horizonHours,
    isClimatologicalFallback: true,
  };
}

// ============================================================================
// LIVE OPEN-METEO CACHED CLIENT ABSTRACTION
// ============================================================================
const seriesCache = new Map<string, { data: HourlyWeatherSeries; cachedAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 Minutes Cache

function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * Fetches and merges hourly atmospheric & marine forecasts from Open-Meteo.
 */
export async function fetchHourlyWeatherSeries(
  lat: number,
  lng: number
): Promise<HourlyWeatherSeries> {
  const key = getCacheKey(lat, lng);
  const now = Date.now();
  const cached = seriesCache.get(key);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const atmoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=wind_speed_10m,wind_direction_10m,precipitation,weather_code,visibility&forecast_days=7`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=wave_height,wave_direction,swell_wave_height&forecast_days=7`;

  try {
    const [atmoRes, marineRes] = await Promise.all([
      fetch(atmoUrl, { signal: AbortSignal.timeout(6000) }).catch(() => null),
      fetch(marineUrl, { signal: AbortSignal.timeout(6000) }).catch(() => null),
    ]);

    const atmoData = atmoRes && atmoRes.ok ? await atmoRes.json() : null;
    const marineData = marineRes && marineRes.ok ? await marineRes.json() : null;

    const hourlyTimes: string[] = atmoData?.hourly?.time || marineData?.hourly?.time || [];
    const times = hourlyTimes.map((iso) => new Date(iso + "Z").getTime());

    const atmoHourly = atmoData?.hourly || {};
    const marineHourly = marineData?.hourly || {};

    const windSpeedKmH: number[] = atmoHourly.wind_speed_10m || [];
    const windSpeedMs = windSpeedKmH.map((kmh) => kmh / 3.6);
    const windDirectionDeg: number[] = atmoHourly.wind_direction_10m || [];
    const precipitationMmH: number[] = atmoHourly.precipitation || [];
    const weatherCode: number[] = atmoHourly.weather_code || [];
    const visibilityM: number[] = atmoHourly.visibility || [];

    const waveHeightM: number[] = marineHourly.wave_height || [];
    const waveDirectionDeg: number[] = marineHourly.wave_direction || [];
    const swellHeightM: number[] = marineHourly.swell_wave_height || [];

    // Fallback alignment for inland/coastal points where marine model returns null
    const len = times.length || 24;
    const filledTimes = times.length > 0 ? times : Array.from({ length: len }, (_, i) => now + i * 3600_000);

    const series: HourlyWeatherSeries = {
      times: filledTimes,
      windSpeedMs: windSpeedMs.length ? windSpeedMs : Array(len).fill(5.0),
      windDirectionDeg: windDirectionDeg.length ? windDirectionDeg : Array(len).fill(0),
      precipitationMmH: precipitationMmH.length ? precipitationMmH : Array(len).fill(0),
      weatherCode: weatherCode.length ? weatherCode : Array(len).fill(0),
      waveHeightM: waveHeightM.length ? waveHeightM : Array(len).fill(1.2),
      waveDirectionDeg: waveDirectionDeg.length ? waveDirectionDeg : Array(len).fill(0),
      swellHeightM: swellHeightM.length ? swellHeightM : Array(len).fill(0.8),
      visibilityM: visibilityM.length ? visibilityM : Array(len).fill(10000),
      forecastRunTime: now,
    };

    seriesCache.set(key, { data: series, cachedAt: now });
    return series;
  } catch {
    // If external network fails, return safe climatological series
    const fallbackLen = 72;
    const series: HourlyWeatherSeries = {
      times: Array.from({ length: fallbackLen }, (_, i) => now + i * 3600_000),
      windSpeedMs: Array(fallbackLen).fill(5.5),
      windDirectionDeg: Array(fallbackLen).fill(240),
      precipitationMmH: Array(fallbackLen).fill(0),
      weatherCode: Array(fallbackLen).fill(0),
      waveHeightM: Array(fallbackLen).fill(1.2),
      waveDirectionDeg: Array(fallbackLen).fill(240),
      swellHeightM: Array(fallbackLen).fill(0.8),
      visibilityM: Array(fallbackLen).fill(10000),
      forecastRunTime: now,
    };
    return series;
  }
}

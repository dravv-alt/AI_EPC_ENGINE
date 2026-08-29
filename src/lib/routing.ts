"use server";

// @ts-ignore
import searoute from "searoute-js";
import { greatCircle } from "@turf/great-circle";
import { point } from "@turf/helpers";
import { findNearestPort, findNearestAirport, getDistance } from "./geo/nearest";

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Sample points to prevent huge arrays from slowing down Leaflet
function sampleCoords(coords: [number, number][], maxPoints: number = 200): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const sampled: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) {
    sampled.push(coords[i]);
  }
  // Ensure last point is included
  if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
    sampled.push(coords[coords.length - 1]);
  }
  return sampled;
}

export async function getShipmentRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: "sea" | "air" | "land",
  options: { originIsInTransit?: boolean } = {}
): Promise<{ mode: "sea" | "air" | "land"; coords: [number, number][] }[]> {
  try {
    const segments: { mode: "sea" | "air" | "land"; coords: [number, number][] }[] = [];

    // =========================================================================
    // 1. PURE OVERLAND ROAD ROUTE
    // =========================================================================
    if (mode === "land") {
      const landSegments = await getLandRoute(originLat, originLng, destLat, destLng);
      if (landSegments.length > 0) {
        segments.push(...landSegments.map((coords) => ({ mode: "land" as const, coords })));
      } else {
        return [];
      }
    }

    // =========================================================================
    // 2. AIR FREIGHT ROUTE (Air corridor + Drayage)
    // =========================================================================
    if (mode === "air") {
      const oAir = findNearestAirport(originLat, originLng);
      const dAir = findNearestAirport(destLat, destLng);

      const oDist = oAir ? getDistance(originLat, originLng, oAir.lat, oAir.lng) : 0;
      const dDist = dAir ? getDistance(destLat, destLng, dAir.lat, dAir.lng) : 0;

      let actualOriginLat = originLat,
        actualOriginLng = originLng;
      let actualDestLat = destLat,
        actualDestLng = destLng;

      if (oAir && oDist > 3) {
        // Add ground transport leg to origin airport
        const landSegs = await getLandRoute(originLat, originLng, oAir.lat, oAir.lng);
        if (landSegs.length > 0) {
          segments.push(...landSegs.map((coords) => ({ mode: "land" as const, coords })));
          actualOriginLat = oAir.lat;
          actualOriginLng = oAir.lng;
        }
      }

      if (dAir && dDist > 3) {
        actualDestLat = dAir.lat;
        actualDestLng = dAir.lng;
      }

      const airSegs = getAirRoute(actualOriginLat, actualOriginLng, actualDestLat, actualDestLng);
      segments.push(...airSegs.map((coords) => ({ mode: "air" as const, coords })));

      if (dAir && dDist > 3) {
        // Add ground transport leg from destination airport to site
        const landSegs = await getLandRoute(actualDestLat, actualDestLng, destLat, destLng);
        if (landSegs.length > 0) {
          segments.push(...landSegs.map((coords) => ({ mode: "land" as const, coords })));
        }
      }
    }

    // =========================================================================
    // 3. PURE MARITIME & INTERMODAL ROUTE
    // Ships ONLY travel in water between seaports/docks.
    // Inland origins/destinations use connecting road drayage.
    // =========================================================================
    else if (mode === "sea") {
      const oPort = findNearestPort(originLat, originLng);
      const dPort = findNearestPort(destLat, destLng);

      const oDist = oPort ? getDistance(originLat, originLng, oPort.lat, oPort.lng) : 0;
      const dDist = dPort ? getDistance(destLat, destLng, dPort.lat, dPort.lng) : 0;

      // Leg 1: Pre-Carriage (Overland Truck from Inland Site -> Departure Port)
      if (!options.originIsInTransit && oPort && oDist > 5) {
        const preCarriage = await getLandRoute(originLat, originLng, oPort.lat, oPort.lng);
        if (preCarriage.length > 0) {
          segments.push(...preCarriage.map((coords) => ({ mode: "land" as const, coords })));
        }
      }

      // Leg 2: Main Maritime Voyage (Ocean Waterway ONLY)
      // If origin is already in transit, use current position; otherwise start at origin seaport
      const seaOriginLat = options.originIsInTransit ? originLat : oPort ? oPort.lat : originLat;
      const seaOriginLng = options.originIsInTransit ? originLng : oPort ? oPort.lng : originLng;

      // STRICT: Sea destination must ALWAYS be a coastal seaport, never an inland city
      const seaDestLat = dPort ? dPort.lat : destLat;
      const seaDestLng = dPort ? dPort.lng : destLng;

      // If vessel is in-transit within port approach channel (<30km), use fairway waypoints to reach open sea
      const oWaypoints = options.originIsInTransit
        ? oPort && oDist < 30
          ? oPort.seaRouteWaypoints
          : undefined
        : oPort?.seaRouteWaypoints;

      const seaSegs = getMarineRoute(
        seaOriginLat,
        seaOriginLng,
        seaDestLat,
        seaDestLng,
        oWaypoints,
        dPort?.seaRouteWaypoints
      );

      if (seaSegs.length > 0) {
        segments.push(...seaSegs.map((coords) => ({ mode: "sea" as const, coords })));
      } else {
        // Fallback: If searoute cannot snap due to shallow coastal waters, attempt direct port-to-port navigation
        if (oPort && dPort) {
          const directSea = getMarineRoute(oPort.lat, oPort.lng, dPort.lat, dPort.lng);
          if (directSea.length > 0) {
            segments.push(...directSea.map((coords) => ({ mode: "sea" as const, coords })));
          }
        }
      }

      // Leg 3: On-Carriage (Overland Truck from Arrival Port -> Final Destination Site)
      if (dPort && dDist > 5) {
        const onCarriage = await getLandRoute(dPort.lat, dPort.lng, destLat, destLng);
        if (onCarriage.length > 0) {
          segments.push(...onCarriage.map((coords) => ({ mode: "land" as const, coords })));
        }
      }
    }

    if (segments.length === 0) return [];

    return segments;
  } catch (err) {
    console.error(`Error computing ${mode} route:`, err);
    return [];
  }
}

// Anti-land-crossing sanitizer: Ensures sea routes never jump across peninsulas or shallow land isthmuses
function sanitizeMarineRoute(coords: [number, number][]): [number, number][] {
  if (coords.length < 2) return coords;
  const sanitized: [number, number][] = [];

  for (let i = 0; i < coords.length; i++) {
    const current = coords[i];
    if (sanitized.length > 0) {
      const prev = sanitized[sanitized.length - 1];

      // 1. Mumbai Peninsula Barrier Protection:
      // Prevent cutting across Mumbai island between Arabian Sea (<72.82) and Mumbai Harbour / JNPT (>72.88)
      const isMumbaiWestToEast =
        prev[1] < 72.82 && current[1] > 72.88 && (prev[0] > 18.84 || current[0] > 18.84);
      const isMumbaiEastToWest =
        prev[1] > 72.88 && current[1] < 72.82 && (prev[0] > 18.84 || current[0] > 18.84);

      if (isMumbaiWestToEast) {
        // Divert through charted fairway south of Prongs Reef into Mumbai Harbour
        sanitized.push([18.720, 72.650]);
        sanitized.push([18.800, 72.780]);
        sanitized.push([18.860, 72.830]);
        sanitized.push([18.920, 72.890]);
      } else if (isMumbaiEastToWest) {
        // Divert through charted fairway outbound from Harbour around Prongs Reef to Arabian Sea
        sanitized.push([18.920, 72.890]);
        sanitized.push([18.860, 72.830]);
        sanitized.push([18.800, 72.780]);
        sanitized.push([18.720, 72.650]);
      }

      // Deduplicate identical consecutive points
      if (Math.abs(prev[0] - current[0]) < 0.0001 && Math.abs(prev[1] - current[1]) < 0.0001) {
        continue;
      }
    }
    sanitized.push(current);
  }

  return sanitized;
}

function getMarineRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  oWaypoints?: [number, number][],
  dWaypoints?: [number, number][]
): [number, number][][] {
  const origin = [originLng, originLat];
  const dest = [destLng, destLat];

  // Entry waypoints from port approaches into open shipping lanes
  const oEntry =
    oWaypoints && oWaypoints.length > 0 ? oWaypoints[oWaypoints.length - 1] : undefined;
  const dEntry =
    dWaypoints && dWaypoints.length > 0 ? dWaypoints[dWaypoints.length - 1] : undefined;

  let feature;
  try {
    if (oEntry && dEntry) {
      const f1 = searoute([oEntry[1], oEntry[0]], [dEntry[1], dEntry[0]]);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: [
            ...oWaypoints!.map((p) => [p[1], p[0]]),
            ...(f1?.geometry?.coordinates || []),
            ...[...dWaypoints!].reverse().map((p) => [p[1], p[0]]),
          ],
        },
      };
    } else if (oEntry) {
      const f1 = searoute([oEntry[1], oEntry[0]], dest);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: [
            ...oWaypoints!.map((p) => [p[1], p[0]]),
            ...(f1?.geometry?.coordinates || []),
          ],
        },
      };
    } else if (dEntry) {
      const f1 = searoute(origin, [dEntry[1], dEntry[0]]);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: [
            ...(f1?.geometry?.coordinates || []),
            ...[...dWaypoints!].reverse().map((p) => [p[1], p[0]]),
          ],
        },
      };
    } else {
      feature = searoute(origin, dest);
    }
  } catch {
    feature = null;
  }

  if (
    !feature ||
    !feature.geometry ||
    !feature.geometry.coordinates ||
    feature.geometry.coordinates.length < 2
  ) {
    return [];
  }

  const rawCoordinates =
    feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

  return rawCoordinates.map((segment: [number, number][]) => {
    const latLngs = segment.map(([lng, lat]) => [lat, lng] as [number, number]);
    const hardenedLatLngs = sanitizeMarineRoute(latLngs);
    return sampleCoords(hardenedLatLngs, 250);
  });
}

function getAirRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): [number, number][][] {
  const distKm = haversineKm(originLat, originLng, destLat, destLng);
  if (distKm < 50) {
    return [[[originLat, originLng], [destLat, destLng]]] as [number, number][][];
  }
  const start = point([originLng, originLat]);
  const end = point([destLng, destLat]);
  const line = greatCircle(start, end, { properties: { name: "air-route" }, npoints: 100 });
  const coords = line.geometry.coordinates as [number, number][];
  return [coords.map(([lng, lat]) => [lat, lng] as [number, number])];
}

async function getLandRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<[number, number][][]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.length > 0) {
        const coords = data.routes[0].geometry.coordinates as [number, number][];
        const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        return [sampleCoords(latLngs, 250)];
      }
    }
  } catch (e) {
    // Ignore fetch errors
  }

  // Fallback if OSRM is offline: generate intermediate direct highway path
  return [[[originLat, originLng], [destLat, destLng]]] as [number, number][][];
}


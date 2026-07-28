"use server";

// @ts-ignore
import searoute from "searoute-js";
import { greatCircle } from "@turf/great-circle";
import { point, lineString } from "@turf/helpers";
import bezierSpline from "@turf/bezier-spline";
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

export async function getShipmentRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: "sea" | "air" | "land",
  options: { originIsInTransit?: boolean } = {}
): Promise<{ mode: "sea" | "air" | "land", coords: [number, number][] }[]> {
  try {
    const segments: { mode: "sea" | "air" | "land", coords: [number, number][] }[] = [];

    if (mode === "land") {
      const landSegments = await getLandRoute(originLat, originLng, destLat, destLng);
      if (landSegments.length > 0) {
        segments.push(...landSegments.map(coords => ({ mode: "land" as const, coords })));
      } else {
        // Never silently redraw a requested road shipment as a sea route.
        return [];
      }
    }

    if (mode === "air") {
      const oAir = findNearestAirport(originLat, originLng);
      const dAir = findNearestAirport(destLat, destLng);

      const oDist = oAir ? getDistance(originLat, originLng, oAir.lat, oAir.lng) : 0;
      const dDist = dAir ? getDistance(destLat, destLng, dAir.lat, dAir.lng) : 0;

      let actualOriginLat = originLat, actualOriginLng = originLng;
      let actualDestLat = destLat, actualDestLng = destLng;

      if (oAir && oDist > 2) { // > 2km from airport, add land leg
        const landSegs = await getLandRoute(originLat, originLng, oAir.lat, oAir.lng);
        if (landSegs.length > 0) {
          segments.push(...landSegs.map(coords => ({ mode: "land" as const, coords })));
          actualOriginLat = oAir.lat;
          actualOriginLng = oAir.lng;
        }
      }

      if (dAir && dDist > 2) {
        actualDestLat = dAir.lat;
        actualDestLng = dAir.lng;
      }

      const airSegs = getAirRoute(actualOriginLat, actualOriginLng, actualDestLat, actualDestLng);
      segments.push(...airSegs.map(coords => ({ mode: "air" as const, coords })));

      if (dAir && dDist > 2) {
        const landSegs = await getLandRoute(actualDestLat, actualDestLng, destLat, destLng);
        if (landSegs.length > 0) {
          segments.push(...landSegs.map(coords => ({ mode: "land" as const, coords })));
        }
      }
    } else if (mode === "sea") {
      const oPort = findNearestPort(originLat, originLng);
      const dPort = findNearestPort(destLat, destLng);

      const oDist = oPort ? getDistance(originLat, originLng, oPort.lat, oPort.lng) : 0;
      const dDist = dPort ? getDistance(destLat, destLng, dPort.lat, dPort.lng) : 0;

      let actualOriginLat = originLat, actualOriginLng = originLng;
      let actualDestLat = destLat, actualDestLng = destLng;

      // A vessel fix is already on the voyage. Never send that point through a
      // road router merely because our finite port catalogue finds a distant
      // "nearest" port; OSRM will snap an offshore point onto land and invent
      // a cross-country route.
      if (!options.originIsInTransit && oPort && oDist > 1) { // > 1km from port, add land leg
        const landSegs = await getLandRoute(originLat, originLng, oPort.lat, oPort.lng);
        if (landSegs.length > 0) {
          segments.push(...landSegs.map(coords => ({ mode: "land" as const, coords })));
          actualOriginLat = oPort.lat;
          actualOriginLng = oPort.lng;
        }
      }

      if (dPort && dDist > 1) {
        actualDestLat = dPort.lat;
        actualDestLng = dPort.lng;
      }

      const seaSegs = getMarineRoute(
        actualOriginLat, actualOriginLng, actualDestLat, actualDestLng,
        options.originIsInTransit ? undefined : oPort?.seaRouteWaypoints,
        dPort?.seaRouteWaypoints
      );
      // Fail closed instead of presenting land legs without a verified marine
      // middle. A straight great-circle is an air route and can cross land.
      if (!seaSegs.length) return [];
      if (options.originIsInTransit) {
        const first = seaSegs[0]?.[0];
        if (first && haversineKm(originLat, originLng, first[0], first[1]) > 1) {
          seaSegs[0].unshift([originLat, originLng]);
        }
      }
      segments.push(...seaSegs.map(coords => ({ mode: "sea" as const, coords })));

      if (dPort && dDist > 1) {
        const landSegs = await getLandRoute(actualDestLat, actualDestLng, destLat, destLng);
        if (landSegs.length > 0) {
          segments.push(...landSegs.map(coords => ({ mode: "land" as const, coords })));
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

function getMarineRoute(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  oWaypoints?: [number, number][],
  dWaypoints?: [number, number][]
): [number, number][][] {
  const origin = [originLng, originLat];
  const dest = [destLng, destLat];

  // The actual points fed into searoute-js
  const oEntry = oWaypoints && oWaypoints.length > 0 ? oWaypoints[oWaypoints.length - 1] : undefined;
  const dEntry = dWaypoints && dWaypoints.length > 0 ? dWaypoints[dWaypoints.length - 1] : undefined;

  let feature;
  try {
    if (oEntry && dEntry) {
      const f1 = searoute([oEntry[1], oEntry[0]], [dEntry[1], dEntry[0]]);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: [
            ...oWaypoints!.map(p => [p[1], p[0]]),
            ...(f1?.geometry?.coordinates || []),
            ...[...dWaypoints!].reverse().map(p => [p[1], p[0]])
          ]
        }
      };
    } else if (oEntry) {
      const f1 = searoute([oEntry[1], oEntry[0]], dest);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: [
            ...oWaypoints!.map(p => [p[1], p[0]]),
            ...(f1?.geometry?.coordinates || [])
          ]
        }
      };
    } else if (dEntry) {
      const f1 = searoute(origin, [dEntry[1], dEntry[0]]);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: [
            ...(f1?.geometry?.coordinates || []),
            ...[...dWaypoints!].reverse().map(p => [p[1], p[0]])
          ]
        }
      };
    } else {
      feature = searoute(origin, dest);
    }
  } catch {
    // A live vessel can be between graph nodes in open water. If the nautical
    // graph cannot snap it, fail closed; an air great-circle is not a valid
    // substitute for a marine route.
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

  const coordinates =
    feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

  return coordinates.map((segment: [number, number][]) => {
    return segment.map(([lng, lat]) => [lat, lng] as [number, number]);
  });
}

function getAirRoute(originLat: number, originLng: number, destLat: number, destLng: number): [number, number][][] {
  const distKm = haversineKm(originLat, originLng, destLat, destLng);
  // For very short distances great-circle produces degenerate results
  if (distKm < 50) {
    return [[[originLat, originLng], [destLat, destLng]]] as [number, number][][];
  }
  const start = point([originLng, originLat]);
  const end = point([destLng, destLat]);
  const line = greatCircle(start, end, { properties: { name: "air-route" }, npoints: 100 });
  const coords = line.geometry.coordinates as [number, number][];
  return [coords.map(([lng, lat]) => [lat, lng] as [number, number])];
}

async function getLandRoute(originLat: number, originLng: number, destLat: number, destLng: number): Promise<[number, number][][]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length > 0) {
      const coords = data.routes[0].geometry.coordinates as [number, number][];
      return [coords.map(([lng, lat]) => [lat, lng] as [number, number])];
    }
  } catch (e) {
    // Ignore fetch errors
  }
  if (haversineKm(originLat, originLng, destLat, destLng) > 100) {
    return [] as [number, number][][];
  }
  return [[[originLat, originLng], [destLat, destLng]]] as [number, number][][];
}

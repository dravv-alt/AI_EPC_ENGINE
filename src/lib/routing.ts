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

export async function getShipmentRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: "sea" | "air" | "land",
  _options: { originIsInTransit?: boolean } = {}
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

      // Hard invariant: a marine segment can only run from a known port to a
      // known port. Current/simulated vessel coordinates are display data and
      // must never replace either endpoint of the planned marine corridor.
      if (!oPort || !dPort) return [];

      const oDist = getDistance(originLat, originLng, oPort.lat, oPort.lng);
      const dDist = getDistance(destLat, destLng, dPort.lat, dPort.lng);

      if (oDist > 1) { // > 1km from port, add the required road leg
        const landSegs = await getLandRoute(originLat, originLng, oPort.lat, oPort.lng);
        if (!landSegs.length) return [];
        segments.push(...landSegs.map(coords => ({ mode: "land" as const, coords })));
      }

      const seaSegs = getMarineRoute(
        oPort.lat, oPort.lng, dPort.lat, dPort.lng,
        oPort.seaRouteWaypoints,
        dPort.seaRouteWaypoints
      );
      // Fail closed instead of presenting land legs without a verified marine
      // middle. A straight great-circle is an air route and can cross land.
      if (!seaSegs.length) return [];
      segments.push(...seaSegs.map(coords => ({ mode: "sea" as const, coords })));

      if (dDist > 1) {
        const landSegs = await getLandRoute(dPort.lat, dPort.lng, destLat, destLng);
        if (!landSegs.length) return [];
        segments.push(...landSegs.map(coords => ({ mode: "land" as const, coords })));
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

  const trimGraphPath = (
    raw: [number, number][],
    requestedStart: [number, number],
    requestedEnd: [number, number]
  ) => {
    if (raw.length < 2) return [];
    const distance = (coordinate: [number, number], requested: [number, number]) =>
      haversineKm(coordinate[1], coordinate[0], requested[1], requested[0]);
    let startIndex = 0;
    for (let index = 1; index < raw.length; index++) {
      if (distance(raw[index], requestedStart) < distance(raw[startIndex], requestedStart)) startIndex = index;
    }
    let endIndex = startIndex;
    for (let index = startIndex + 1; index < raw.length; index++) {
      if (distance(raw[index], requestedEnd) < distance(raw[endIndex], requestedEnd)) endIndex = index;
    }
    return endIndex > startIndex ? raw.slice(startIndex, endIndex + 1) : [];
  };

  const withoutAdjacentDuplicates = (coordinates: [number, number][]) =>
    coordinates.filter((coordinate, index) => index === 0
      || coordinate[0] !== coordinates[index - 1][0]
      || coordinate[1] !== coordinates[index - 1][1]);

  let feature: { geometry: { type: "LineString"; coordinates: [number, number][] } } | null;
  try {
    if (oEntry && dEntry) {
      const f1 = searoute([oEntry[1], oEntry[0]], [dEntry[1], dEntry[0]]);
      const graphPath = trimGraphPath(
        f1?.geometry?.coordinates || [],
        [oEntry[1], oEntry[0]],
        [dEntry[1], dEntry[0]]
      );
      feature = {
        geometry: {
          type: "LineString",
          coordinates: withoutAdjacentDuplicates([
            ...oWaypoints!.map(p => [p[1], p[0]]),
            ...graphPath,
            ...[...dWaypoints!].reverse().map(p => [p[1], p[0]])
          ] as [number, number][])
        }
      };
    } else if (oEntry) {
      const f1 = searoute([oEntry[1], oEntry[0]], dest);
      const graphPath = trimGraphPath(f1?.geometry?.coordinates || [], [oEntry[1], oEntry[0]], dest as [number, number]);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: withoutAdjacentDuplicates([
            ...oWaypoints!.map(p => [p[1], p[0]]),
            ...graphPath
          ] as [number, number][])
        }
      };
    } else if (dEntry) {
      const f1 = searoute(origin, [dEntry[1], dEntry[0]]);
      const graphPath = trimGraphPath(f1?.geometry?.coordinates || [], origin as [number, number], [dEntry[1], dEntry[0]]);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: withoutAdjacentDuplicates([
            ...graphPath,
            ...[...dWaypoints!].reverse().map(p => [p[1], p[0]])
          ] as [number, number][])
        }
      };
    } else {
      const rawFeature = searoute(origin, dest);
      feature = {
        geometry: {
          type: "LineString",
          coordinates: trimGraphPath(rawFeature?.geometry?.coordinates || [], origin as [number, number], dest as [number, number])
        }
      };
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

  const coordinates = [feature.geometry.coordinates];

  const segments = coordinates.map((segment: [number, number][]) => {
    return segment.map(([lng, lat]) => [lat, lng] as [number, number]);
  });

  // searoute-js snaps inputs onto its graph. Restore the exact validated port
  // coordinates so the rendered blue geometry has port-to-port boundaries.
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  if (!firstSegment || !lastSegment) return [];
  if (haversineKm(originLat, originLng, firstSegment[0][0], firstSegment[0][1]) > 0.01) {
    firstSegment.unshift([originLat, originLng]);
  }
  const lastPoint = lastSegment[lastSegment.length - 1];
  if (haversineKm(destLat, destLng, lastPoint[0], lastPoint[1]) > 0.01) {
    lastSegment.push([destLat, destLng]);
  }
  return segments;
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

"use server";

// @ts-ignore
import searoute from "searoute-js";

export async function getMarineRoute(originLat: number, originLng: number, destLat: number, destLng: number) {
  try {
    const origin = [originLng, originLat];
    const dest = [destLng, destLat];

    // @ts-ignore
    const feature = searoute(origin, dest);
    const coordinates = feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

    // Transform coordinates for Leaflet: [lat, lng]
    return coordinates.map((segment: any) =>
      segment.map(([lng, lat]: [number, number]) => [lat, lng])
    );
  } catch (err) {
    console.error("Error computing marine route:", err);
    return [];
  }
}

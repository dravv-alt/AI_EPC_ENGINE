import assert from "node:assert/strict";
import { AisStreamClient } from "../src/lib/supply/ais-client";
import { OpenMeteoWeatherClient } from "../src/lib/supply/weather-client";

const query = {
  mmsi: "123456789",
  originLat: 18.9,
  originLng: 72.8,
  destinationLat: 1.3,
  destinationLng: 103.8,
  departedAt: new Date("2026-01-01T00:00:00.000Z"),
  plannedEta: new Date("2026-01-10T00:00:00.000Z"),
  now: new Date("2026-01-05T00:00:00.000Z"),
};

async function main() {
  const ais = await new AisStreamClient().poll(query);
  assert.equal(ais.dataAvailable, false, "Configured AIS mode without a key must be unavailable, not simulated.");
  assert.equal(ais.positionSource, "unavailable");
  assert.equal(ais.lat, null);
  assert.match(ais.reason, /AISSTREAM_API_KEY/);

  const weather = await new OpenMeteoWeatherClient("http://127.0.0.1:1/v1/marine").forecast({ lat: query.originLat, lng: query.originLng, mmsi: query.mmsi });
  assert.equal(weather.dataAvailable, false, "Live Open-Meteo failure must be unavailable, not synthetic.");
  assert.equal(weather.weatherDelayFactor, null);
  assert.equal(weather.source, "open-meteo");
  assert.match(weather.reason, /Open-Meteo marine forecast unavailable/);

  console.log("Live AIS and weather clients fail closed with explicit provenance when their live provider is unavailable.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import assert from "node:assert/strict";
import { getShipmentRoute } from "../src/lib/routing";

async function main() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const coordinates = url.pathname.split("/").at(-1)?.split(";").map((pair) => pair.split(",").map(Number));
    assert.equal(coordinates?.length, 2, "OSRM request must contain two endpoints");
    return new Response(JSON.stringify({
      code: "Ok",
      routes: [{ geometry: { coordinates } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const route = await getShipmentRoute(18.520, 73.856, 40.712, -74.006, "sea", { originIsInTransit: true });
    assert.deepEqual(route.map((segment) => segment.mode), ["land", "sea", "land"]);

    const sea = route.find((segment) => segment.mode === "sea");
    assert.ok(sea, "A marine segment is required");
    assert.deepEqual(sea.coords[0], [18.949, 72.951], "Blue route must start at Nhava Sheva port");
    assert.deepEqual(sea.coords.at(-1), [40.670, -74.043], "Blue route must end at New York/New Jersey port");
    assert.notDeepEqual(sea.coords[0], [18.520, 73.856], "An inland shipment coordinate must never start a blue route");

    const offshoreIndex = sea.coords.findIndex(([lat, lng]) => lat >= 18.4 && lat <= 19.1 && lng <= 72.5);
    assert.ok(offshoreIndex >= 0, "The Mumbai corridor must reach the reviewed offshore channel");
    const returnsToMumbaiLand = sea.coords.slice(offshoreIndex + 1).some(([lat, lng]) =>
      lat >= 18.75 && lat <= 19.15 && lng > 72.5 && lng < 72.95
    );
    assert.equal(returnsToMumbaiLand, false, "The marine graph must not snap back across the Mumbai peninsula");

    console.log("Shipment routing invariant verified: land -> port-to-port sea -> land.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

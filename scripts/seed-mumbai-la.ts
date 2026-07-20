import { db } from "../src/lib/db/client";
import { shipments } from "../src/lib/db/schema";
import { randomUUID } from "node:crypto";

const ids = {
  tenant: "10000000-0000-4000-8000-000000000001",
  user: "10000000-0000-4000-8000-000000000002",
  project: "10000000-0000-4000-8000-000000000003",
  asset: "10000000-0000-4000-8000-000000000005",
};

async function seedShipments() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await db.insert(shipments).values([
    {
      id: randomUUID(),
      tenantId: ids.tenant,
      projectId: ids.project,
      equipmentId: ids.asset,
      name: "Mumbai to LA Cargo (Sea)",
      transportMode: "sea",
      originName: "Mumbai",
      originLat: "18.95", // Port of Mumbai
      originLng: "72.93",
      destinationName: "Los Angeles",
      destinationLat: "33.7386", // Port of LA
      destinationLng: "-118.2426",
      currentLat: "25.0",
      currentLng: "140.0", // Middle of the Pacific Ocean
      positionSource: "simulated",
      plannedEta: tomorrow,
      requiredOnSite: tomorrow,
      status: "green",
      createdBy: ids.user,
    },
    {
      id: randomUUID(),
      tenantId: ids.tenant,
      projectId: ids.project,
      equipmentId: ids.asset,
      name: "London to New York (Air)",
      transportMode: "air",
      originName: "London Heathrow",
      originLat: "51.4700",
      originLng: "-0.4543",
      destinationName: "JFK New York",
      destinationLat: "40.6413",
      destinationLng: "-73.7781",
      currentLat: "49.0",
      currentLng: "-30.0", // Mid Atlantic
      positionSource: "simulated",
      plannedEta: tomorrow,
      requiredOnSite: tomorrow,
      status: "green",
      createdBy: ids.user,
    },
    {
      id: randomUUID(),
      tenantId: ids.tenant,
      projectId: ids.project,
      equipmentId: ids.asset,
      name: "Frankfurt to Paris (Land)",
      transportMode: "land",
      originName: "Frankfurt",
      originLat: "50.1109",
      originLng: "8.6821",
      destinationName: "Paris",
      destinationLat: "48.8566",
      destinationLng: "2.3522",
      currentLat: "49.25",
      currentLng: "5.5", // Halfway
      positionSource: "simulated",
      plannedEta: tomorrow,
      requiredOnSite: tomorrow,
      status: "green",
      createdBy: ids.user,
    }
  ]);

  console.log("Seeded multimodal shipments!");
  process.exit(0);
}

seedShipments().catch((error) => {
  console.error(error);
  process.exit(1);
});

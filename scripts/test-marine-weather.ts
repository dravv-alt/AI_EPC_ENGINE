import { MarineWeatherClient } from "../src/lib/predictive-risk/marine-meteo";

async function main() {
  const lat = parseFloat(process.argv[2] ?? "25.0");
  const lon = parseFloat(process.argv[3] ?? "140.0"); // Default: Pacific Ocean

  if (isNaN(lat) || isNaN(lon)) {
    console.error("Usage: npx tsx scripts/test-marine-weather.ts [latitude] [longitude]");
    process.exit(1);
  }

  const client = new MarineWeatherClient(lat, lon);
  const dummyTask = {
    taskId: "marine-task",
    taskName: "Test Marine Task",
    startAt: new Date(),
    endAt: new Date(),
    deadline: null,
    isCritical: false
  };

  const result = await client.poll(dummyTask);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

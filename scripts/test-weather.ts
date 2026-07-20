import { OpenMeteoWeatherClient } from "../src/lib/predictive-risk/open-meteo";

async function main() {
  const lat = parseFloat(process.argv[2] ?? "19.076");
  const lon = parseFloat(process.argv[3] ?? "72.8777");

  if (isNaN(lat) || isNaN(lon)) {
    console.error("Usage: node scripts/test-weather.ts [latitude] [longitude]");
    process.exit(1);
  }

  const client = new OpenMeteoWeatherClient(lat, lon);
  const dummyTask = {
    taskId: "test-task",
    taskName: "Test Task",
    startAt: new Date(),
    endAt: new Date(),
    deadline: null,
    isCritical: false
  };

  const result = await client.poll(dummyTask);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

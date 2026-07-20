import { startWorker } from "../src/lib/jobs/worker";
import { registerPollSchedules } from "../src/lib/jobs/scheduler";
import { startAisWorker } from "./ais-worker";

const worker = startWorker();
const aisWorker = startAisWorker();
registerPollSchedules()
  .then((result) => console.log(`Poll schedules: ${JSON.stringify(result)}`))
  .catch((error) => console.error(`Poll schedule registration failed: ${error instanceof Error ? error.message : error}`));
console.log("Pramana core worker is listening on the core queue.");
const shutdown = async () => { aisWorker?.close(); await worker.close(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

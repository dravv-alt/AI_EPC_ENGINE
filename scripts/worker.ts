import { startWorker } from "../src/lib/jobs/worker";

const worker = startWorker();
console.log("Pramana core worker is listening on the core queue.");
const shutdown = async () => { await worker.close(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

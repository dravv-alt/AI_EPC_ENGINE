import { loadEnvConfig } from "@next/env";

// Next.js loads .env.local for the web process, while a standalone tsx worker
// does not. Load the same local configuration before importing modules that
// validate env so the worker shares the app's database, Redis, Ollama, and
// Clerk-adjacent runtime settings.
loadEnvConfig(process.cwd());

async function main() {
  const { startWorker } = await import("../src/lib/jobs/worker");
  const { registerPollSchedules } = await import("../src/lib/jobs/scheduler");
  const { startAisWorker } = await import("./ais-worker");
  const worker = startWorker();
  const aisWorker = startAisWorker();
  registerPollSchedules()
    .then((result) => console.log(`Poll schedules: ${JSON.stringify(result)}`))
    .catch((error) => console.error(`Poll schedule registration failed: ${error instanceof Error ? error.message : error}`));
  console.log("Pramana core worker is listening on the core queue.");
  const shutdown = async () => { aisWorker?.close(); await worker.close(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main().catch((error) => {
  console.error("Unable to start Pramana worker:", error instanceof Error ? error.message : error);
  process.exit(1);
});

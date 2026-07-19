import { startWorker } from "../src/lib/jobs/worker";
import { Queue } from "bullmq";
import { getRedis } from "../src/lib/redis/client";
import { env } from "../src/lib/env";

const worker = startWorker();
console.log("Pramana core worker is listening on the core queue.");

const queue = new Queue("core", { connection: getRedis(), prefix: env.REDIS_PREFIX });

// Enqueue a repeatable job to poll risks autonomously (runs every 5 minutes for demonstration purposes)
queue.add(
  "risk.poll.all",
  {},
  { 
    repeat: { pattern: "*/5 * * * *" },
    jobId: "recurring-risk-poll-all"
  }
).then(() => {
  console.log("Registered recurring job: risk.poll.all (Cron: */5 * * * *)");
}).catch(console.error);

queue.add(
  "supply.weather.poll",
  {},
  {
    repeat: { pattern: "*/15 * * * *" }, // every 15 minutes
    jobId: "recurring-weather-poll"
  }
).then(() => {
  console.log("Registered recurring job: supply.weather.poll (Cron: */15 * * * *)");
}).catch(console.error);

const shutdown = async () => { 
  await worker.close(); 
  await queue.close(); 
  process.exit(0); 
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

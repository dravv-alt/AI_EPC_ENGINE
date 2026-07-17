import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { redisHealth } from "../src/lib/redis/client";

const port = process.env.PORT ?? "4173";
const baseUrl = process.env.APP_BASE_URL ?? `http://localhost:${port}`;
const children: ChildProcess[] = [];

async function assertDependencies() {
  await access(".next/BUILD_ID");
  await db.execute(sql`select 1`);
  const redis = await redisHealth();
  if (redis.status !== "ok") throw new Error("Redis is not available.");
  for (const [name, url] of [["ingestion", process.env.INGESTION_SERVICE_URL ?? "http://localhost:8001/health"], ["solver", process.env.SOLVER_SERVICE_URL ?? "http://localhost:8002/health"]] as const) {
    const healthUrl = url.endsWith("/health") ? url : `${url}/health`;
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) throw new Error(`${name} health check returned HTTP ${response.status}.`);
  }
}

function start(command: string, args: string[]) {
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, APP_BASE_URL: baseUrl }, stdio: "inherit" });
  children.push(child);
  child.once("exit", (code, signal) => {
    if (code && code !== 0) {
      console.error(`${command} stopped with code ${code}${signal ? ` (${signal})` : ""}.`);
      void shutdown(1);
    }
  });
  return child;
}

let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit(code);
}

async function main() {
  await assertDependencies();
  console.log(`Dependencies are healthy. Starting Pramana Cx at ${baseUrl}.`);
  start("node_modules/.bin/tsx", ["scripts/worker.ts"]);
  start("node_modules/.bin/next", ["start", "-p", port]);
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

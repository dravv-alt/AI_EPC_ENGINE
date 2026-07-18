import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";

const root = process.cwd();
const devPort = 4273;
const credentialsPort = 4185;
const redisPrefix = `pramana-verify-${randomUUID()}`;
const children: ChildProcess[] = [];
const shared = { ...process.env, AUTH_ENCRYPTION_KEY: "isolated-verification-key-at-least-32-characters", INFRA_ALLOW_DEGRADED: "false", OBJECT_STORAGE_DRIVER: "local", MODEL_PROVIDER: "mock" };

function run(label: string, command: string, args: string[], env: NodeJS.ProcessEnv = shared) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (chunk) => process.stdout.write(`[runtime] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[runtime] ${chunk}`));
  children.push(child);
  return child;
}

async function waitFor(url: string, child: ChildProcess) {
  let lastFailure = "no response";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Runtime stopped before ${url} became healthy.`);
    const probe = spawnSync("curl", ["-fsS", "--max-time", "1", url], { encoding: "utf8" });
    if (probe.status === 0) return;
    lastFailure = probe.stderr.trim() || `curl exited ${probe.status ?? "without a status"}`;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastFailure}.`);
}

async function stopChildren() {
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
}

async function main() {
  run("Database migrations", "npm", ["run", "db:migrate"]);
  run("TypeScript", "npm", ["run", "typecheck"]);
  run("Production build", "npm", ["run", "build"]);
  run("Seed prerequisites", "npm", ["run", "db:seed"]);

  const developmentBase = `http://localhost:${devPort}`;
  const developmentEnv = { ...shared, AUTH_MODE: "development", APP_BASE_URL: developmentBase, REDIS_PREFIX: redisPrefix };
  const worker = start("node_modules/.bin/tsx", ["scripts/worker.ts"], developmentEnv);
  const development = start("node_modules/.bin/next", ["start", "-p", String(devPort)], developmentEnv);
  await waitFor(`${developmentBase}/api/health`, development);
  if (worker.exitCode !== null) throw new Error("Verification worker failed to start.");

  const credentialsBase = `http://localhost:${credentialsPort}`;
  const credentialsEnv = { ...shared, AUTH_MODE: "credentials", APP_BASE_URL: credentialsBase, REDIS_PREFIX: `${redisPrefix}-credentials` };
  const credentials = start("node_modules/.bin/next", ["start", "-p", String(credentialsPort)], credentialsEnv);
  await waitFor(`${credentialsBase}/api/health`, credentials);

  run("Phase 0 contracts", "npm", ["run", "verify:phase0"], developmentEnv);
  run("Credentials and MFA", "npm", ["run", "verify:credentials-http"], { ...credentialsEnv, CREDENTIALS_TEST_URL: credentialsBase });
  run("Evidence to turnover", "npm", ["run", "verify:evidence-turnover-http"], { ...credentialsEnv, CREDENTIALS_TEST_URL: credentialsBase });
  run("Deterministic schedule", "npm", ["run", "verify:schedule-http"], { ...developmentEnv, SCHEDULE_TEST_URL: developmentBase });
  run("Governed Cx", "npm", ["run", "verify:cx-http"], { ...developmentEnv, CX_TEST_URL: developmentBase });
  run("Governed compliance", "npm", ["run", "verify:compliance-http"], { ...developmentEnv, COMPLIANCE_TEST_URL: developmentBase });
  run("Predictive risk", "npm", ["run", "verify:risk-http"], { ...developmentEnv, RISK_TEST_URL: developmentBase });
  run("Recurring poll loop", "npm", ["run", "verify:poll-http"], { ...developmentEnv, POLL_TEST_URL: developmentBase });
  run("Canonical audit chain", "npm", ["run", "verify:audit"], developmentEnv);
  console.log("\nAll local verification suites passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(stopChildren);

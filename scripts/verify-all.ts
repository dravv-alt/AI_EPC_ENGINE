import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";

const root = process.cwd();
const devPort = 4273;
const credentialsPort = 4185;
const redisPrefix = `pramana-verify-${randomUUID()}`;
const children: ChildProcess[] = [];
// This matrix deliberately runs without the optional external services. The
// production Compose configuration sets this false, so a deployment still
// fails closed when any required dependency is unavailable.
const shared = { ...process.env, AUTH_ENCRYPTION_KEY: "isolated-verification-key-at-least-32-characters", INFRA_ALLOW_DEGRADED: "true", OBJECT_STORAGE_DRIVER: "local", MODEL_PROVIDER: "mock", EMBEDDING_PROVIDER: "mock" };

function run(label: string, command: string, args: string[], env: NodeJS.ProcessEnv = shared) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", shell: true });
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], shell: true });
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
  run("Config targets", "npm", ["run", "verify:config-targets"]);
  run("Compliance controlled golden set", "npm", ["run", "verify:compliance-golden"]);
  run("Model provider foundation", "npm", ["run", "verify:model-provider"]);
  run("Deep-link targets and public-geocoder safety", "npm", ["run", "verify:deep-links"]);
  // Skips cleanly when EMBEDDING_PROVIDER !== "service" (the offline default),
  // so it never blocks the containerless matrix.
  run("Retrieval service (embed/rerank)", "npm", ["run", "verify:retrieval-service"]);
  run("Production build", "npm", ["run", "build"]);
  run("Seed prerequisites", "npm", ["run", "db:seed"]);
  run("Relational and cross-feature data integrity", "npm", ["run", "verify:data-integrity"]);
  run("Compliance controlled-source authority", "npm", ["run", "verify:compliance-authority"]);

  const developmentBase = `http://localhost:${devPort}`;
  const developmentEnv = { ...shared, AUTH_MODE: "development", APP_BASE_URL: developmentBase, REDIS_PREFIX: redisPrefix };
  // The verification environment is supplied explicitly above. Loading a local
  // .env here is both unnecessary and makes this isolated test fail on clean
  // checkout/CI workspaces where no developer secrets file exists.
  const worker = start("npx", ["tsx", "scripts/worker.ts"], developmentEnv);
  const development = start("npx", ["next", "start", "-p", String(devPort)], developmentEnv);
  await waitFor(`${developmentBase}/api/health`, development);
  if (worker.exitCode !== null) throw new Error("Verification worker failed to start.");

  const credentialsBase = `http://localhost:${credentialsPort}`;
  const credentialsEnv = { ...shared, AUTH_MODE: "credentials", APP_BASE_URL: credentialsBase, REDIS_PREFIX: `${redisPrefix}-credentials` };
  const credentials = start("npx", ["next", "start", "-p", String(credentialsPort)], credentialsEnv);
  await waitFor(`${credentialsBase}/api/health`, credentials);

  run("Phase 0 contracts", "npm", ["run", "verify:phase0"], developmentEnv);
  run("Credentials and MFA", "npm", ["run", "verify:credentials-http"], { ...credentialsEnv, CREDENTIALS_TEST_URL: credentialsBase });
  run("Evidence to turnover", "npm", ["run", "verify:evidence-turnover-http"], { ...credentialsEnv, CREDENTIALS_TEST_URL: credentialsBase });
  run("Turnover Cx manifest", "npm", ["run", "verify:turnover-cx-http"], { ...credentialsEnv, CREDENTIALS_TEST_URL: credentialsBase });
  run("Turnover manifest provenance", "npm", ["run", "verify:turnover-provenance-http"], { ...credentialsEnv, TURNOVER_PROVENANCE_TEST_URL: credentialsBase });
  run("Turnover schedule/solver provenance", "npm", ["run", "verify:turnover-schedule-provenance"], { ...credentialsEnv, TURNOVER_SCHEDULE_PROVENANCE_TEST_URL: credentialsBase });
  run("Evidence entropy / weak-evidence score", "npm", ["run", "verify:evidence-entropy"], { ...credentialsEnv, CREDENTIALS_TEST_URL: credentialsBase });
  run("Ingestion multi-format support", "npm", ["run", "verify:ingestion-formats-http"], { ...developmentEnv, INGESTION_FORMATS_TEST_URL: developmentBase });
  run("Deterministic schedule", "npm", ["run", "verify:schedule-http"], { ...developmentEnv, SCHEDULE_TEST_URL: developmentBase });
  run("Solver timeout, retry, and SOLVE_FAILED resilience", "npm", ["run", "verify:solver-resilience"]);
  run("Governed Cx", "npm", ["run", "verify:cx-http"], { ...developmentEnv, CX_TEST_URL: developmentBase });
  run("Governed compliance", "npm", ["run", "verify:compliance-http"], { ...developmentEnv, COMPLIANCE_TEST_URL: developmentBase });
  run("Compliance semantic candidate scan", "npm", ["run", "verify:compliance-scan-http"], { ...developmentEnv, COMPLIANCE_SCAN_TEST_URL: developmentBase });
  run("Compliance model advisory verdict with deterministic safety floor", "npm", ["run", "verify:compliance-llm-http"], { ...developmentEnv, COMPLIANCE_LLM_TEST_URL: developmentBase });
  run("Compliance modality tiering", "npm", ["run", "verify:compliance-modality-http"], developmentEnv);
  run("Compliance finding owner/due-date fields", "npm", ["run", "verify:compliance-finding-fields"], { ...developmentEnv, COMPLIANCE_FINDING_FIELDS_TEST_URL: developmentBase });
  run("Teach-back generalized capture and surfacing", "npm", ["run", "verify:teachback-http"], { ...developmentEnv, TEACHBACK_TEST_URL: developmentBase });
  run("Predictive risk", "npm", ["run", "verify:risk-http"], { ...developmentEnv, RISK_TEST_URL: developmentBase });
  run("Predictive-risk lively signals + mitigations", "npm", ["run", "verify:risk-mitigations-http"], { ...developmentEnv, RISK_TEST_URL: developmentBase });
  run("Recurring poll loop", "npm", ["run", "verify:poll-http"], { ...developmentEnv, POLL_TEST_URL: developmentBase });
  run("Risk auto-poll", "npm", ["run", "verify:risk-autopoll-http"], developmentEnv);
  run("HTTP risk signal clients", "npm", ["run", "verify:risk-http-clients"], developmentEnv);
  run("Live AIS position poll", "npm", ["run", "verify:supply-poll-http"], developmentEnv);
  run("Weather status transitions", "npm", ["run", "verify:weather-poll-http"], developmentEnv);
  run("Live events feed", "npm", ["run", "verify:live-events-http"], { ...developmentEnv, LIVE_EVENTS_TEST_URL: developmentBase });
  run("Knowledge embeddings", "npm", ["run", "verify:knowledge-embed"], developmentEnv);
  run("Knowledge semantic query", "npm", ["run", "verify:knowledge-query-http"], { ...developmentEnv, KNOWLEDGE_TEST_URL: developmentBase });
  run("Knowledge rerank + graph context", "npm", ["run", "verify:knowledge-rerank"], developmentEnv);
  run("Knowledge cited-answer synthesis", "npm", ["run", "verify:knowledge-synthesis"], { ...developmentEnv, KNOWLEDGE_TEST_URL: developmentBase });
  run("Knowledge metadata filters (system/asset/gate/revision/date)", "npm", ["run", "verify:knowledge-filters"], { ...developmentEnv, KNOWLEDGE_FILTERS_TEST_URL: developmentBase });
  run("Command center cross-links", "npm", ["run", "verify:command-links-http"], { ...developmentEnv, COMMAND_LINKS_TEST_URL: developmentBase });
  run("RFI similarity retrieval", "npm", ["run", "verify:rfi-similar-http"], { ...developmentEnv, KNOWLEDGE_TEST_URL: developmentBase });
  run("RFI resolution state", "npm", ["run", "verify:rfi-resolution"], { ...developmentEnv, RFI_RESOLUTION_TEST_URL: developmentBase });
  run("Graph node expansion", "npm", ["run", "verify:graph-expansion-http"], { ...developmentEnv, GRAPH_TEST_URL: developmentBase });
  run("Gate schedule context", "npm", ["run", "verify:gate-context-http"], { ...developmentEnv, GATE_CONTEXT_TEST_URL: developmentBase });
  run("Overdue findings in blocker views", "npm", ["run", "verify:overdue-findings"], developmentEnv);
  run("Change blast radius", "npm", ["run", "verify:change-impact-http"], { ...developmentEnv, CHANGE_IMPACT_TEST_URL: developmentBase });
  run("Canonical audit chain", "npm", ["run", "verify:audit"], developmentEnv);

  // Slice 15 hardening: a dedicated server with a low AI rate limit so the 429 is
  // reachable, and the S3 driver pointed at MinIO for the storage round-trip.
  const hardeningPort = 4303;
  const hardeningBase = `http://localhost:${hardeningPort}`;
  const hardeningEnv = { ...shared, AUTH_MODE: "development", APP_BASE_URL: hardeningBase, REDIS_PREFIX: `${redisPrefix}-hardening`, OBJECT_STORAGE_DRIVER: "s3", AI_RATE_LIMIT: "5", AI_RATE_LIMIT_WINDOW_SECONDS: "60" };
  const hardening = start("node_modules/.bin/next", ["start", "-p", String(hardeningPort)], hardeningEnv);
  await waitFor(`${hardeningBase}/api/health`, hardening);
  run("Rate limits and offline/storage hardening", "npm", ["run", "verify:hardening-http"], { ...hardeningEnv, HARDENING_TEST_URL: hardeningBase });
  // Slice 3: stands up its own dedicated low-limit dev + credentials servers, independent of hardeningEnv above.
  run("Rate-limit coverage across endpoint categories", "npm", ["run", "verify:rate-limit-coverage"]);

  // Slice 16: end-to-end composite verification — these compose all the
  // individual-slice checks above into two cross-cutting integration chains.
  run("E2E polling loop", "npm", ["run", "verify:polling-http"], { ...developmentEnv, POLLING_TEST_URL: developmentBase });
  run("E2E knowledge pipeline", "npm", ["run", "verify:knowledge-http"], { ...developmentEnv, KNOWLEDGE_TEST_URL: developmentBase });
  console.log("\nAll local verification suites passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(stopChildren);

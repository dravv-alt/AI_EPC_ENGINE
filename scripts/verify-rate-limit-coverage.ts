import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import process from "node:process";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { auditEvents, authSessions, durableJobs, projectMembers, projects, scheduleResources, tenants, users } from "../src/lib/db/schema";

// Slice 3 — rate-limit coverage across the endpoint categories Rules.md line 87
// names (auth, upload, search, AI, export, schedule, compliance, risk,
// knowledge). This script stands up its own two low-limit servers (one
// development-mode, one credentials-mode, mirroring the pattern
// verify-hardening-http.ts/verify-all.ts already use for AI_RATE_LIMIT) and
// hammers one representative endpoint per newly-limited category past its
// budget, asserting on HTTP status + body only -- never on internal limiter
// state.

const root = process.cwd();
const children: ChildProcess[] = [];
const devPort = 4311;
const credPort = 4312;
const devBase = `http://localhost:${devPort}`;
const credBase = `http://localhost:${credPort}`;
const redisPrefix = `pramana-verify-ratelimit-${randomUUID()}`;

const sharedEnv = {
  ...process.env,
  AUTH_ENCRYPTION_KEY: "isolated-verification-key-at-least-32-characters",
  INFRA_ALLOW_DEGRADED: "false",
  OBJECT_STORAGE_DRIVER: "local",
  MODEL_PROVIDER: "mock",
  EMBEDDING_PROVIDER: "mock"
};

// Low per-category budgets so every limit is deterministically reachable in a
// handful of requests, following the AI_RATE_LIMIT=5 hardening pattern.
const LIMIT = 3;
const devEnv = {
  ...sharedEnv,
  AUTH_MODE: "development",
  APP_BASE_URL: devBase,
  REDIS_PREFIX: `${redisPrefix}-dev`,
  SCHEDULE_RATE_LIMIT: String(LIMIT),
  SCHEDULE_RATE_LIMIT_WINDOW_SECONDS: "60",
  UPLOAD_RATE_LIMIT: String(LIMIT),
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS: "60",
  EXPORT_RATE_LIMIT: String(LIMIT),
  EXPORT_RATE_LIMIT_WINDOW_SECONDS: "60",
  AI_RATE_LIMIT: String(LIMIT),
  AI_RATE_LIMIT_WINDOW_SECONDS: "60"
};
const credEnv = {
  ...sharedEnv,
  AUTH_MODE: "credentials",
  APP_BASE_URL: credBase,
  REDIS_PREFIX: `${redisPrefix}-cred`,
  AUTH_RATE_LIMIT: String(LIMIT),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: "60"
};

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

async function jsonRequest(base: string, path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

/** Drives `limit + 1` requests and asserts the (limit+1)th is a 429 with a
 * retry-after hint, while every request before it is *not* a 429 (whatever the
 * underlying business-logic status is). Returns the final 429 response. */
async function driveToLimit(label: string, limit: number, makeRequest: (index: number) => Promise<{ status: number; body: any; headers: Headers }>) {
  let last: { status: number; body: any; headers: Headers } | undefined;
  for (let i = 0; i < limit + 1; i += 1) {
    const result = await makeRequest(i);
    if (i < limit) {
      assert.notEqual(result.status, 429, `[${label}] request ${i} (within budget ${limit}) must not be rate-limited (got 429: ${JSON.stringify(result.body)}).`);
    } else {
      assert.equal(result.status, 429, `[${label}] request ${i} (budget ${limit} exhausted) must return 429 (got ${result.status}: ${JSON.stringify(result.body)}).`);
      assert.ok(result.body.retryAfter > 0, `[${label}] the 429 body must carry a positive retryAfter hint.`);
      assert.ok(result.headers.get("retry-after"), `[${label}] the 429 response must carry a retry-after header.`);
    }
    last = result;
  }
  console.log(`  ${label}: ${limit} requests served then HTTP 429 at request ${limit + 1} (limit=${limit}).`);
  return last!;
}

async function verifySchedule(projectId: string) {
  const createdResourceIds: string[] = [];
  try {
    const result = await driveToLimit("schedule (resources)", LIMIT, async (i) => {
      const response = await jsonRequest(devBase, `/api/projects/${projectId}/schedule/resources`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `Rate limit probe crew ${i} ${randomUUID()}`, capacity: 1 })
      });
      if (response.status === 201) createdResourceIds.push(response.body.resource.id);
      return response;
    });
    assert.equal(result.status, 429);
  } finally {
    if (createdResourceIds.length) await db.delete(scheduleResources).where(inArray(scheduleResources.id, createdResourceIds));
  }
}

async function verifyUpload(projectId: string) {
  // The upload limiter runs before form parsing, so an intentionally empty
  // multipart body still deterministically exercises the 429 boundary without
  // needing a real file fixture.
  await driveToLimit("upload (sources)", LIMIT, async () => {
    const form = new FormData();
    return jsonRequest(devBase, `/api/projects/${projectId}/sources`, { method: "POST", body: form });
  });
}

async function verifyExport(projectId: string) {
  // The export limiter runs before the gate lookup, so a syntactically valid
  // but non-existent gateId still deterministically exercises the 429
  // boundary without a real gate fixture.
  await driveToLimit("export (turnover-packs)", LIMIT, async () => {
    return jsonRequest(devBase, `/api/projects/${projectId}/turnover-packs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gateId: randomUUID() })
    });
  });
}

async function verifyKnowledge(projectId: string) {
  await driveToLimit("knowledge (rfi-similar)", LIMIT, async (i) => {
    return jsonRequest(devBase, `/api/projects/${projectId}/knowledge/rfi-similar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `rate limit probe rfi text ${i} zzz` })
    });
  });
}

async function registerAccount(email: string, password: string, ip: string) {
  const response = await jsonRequest(credBase, "/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password, displayName: "Rate Limit Verifier", organizationName: "Rate Limit Org", projectName: "Rate Limit Project", projectCode: `RL-${Date.now()}`, timezone: "Asia/Kolkata" })
  });
  assert.equal(response.status, 201, `Registration fixture must succeed (got ${response.status}: ${JSON.stringify(response.body)}).`);
  return response.body as { user: { id: string }; project: { id: string; tenantId: string } };
}

async function verifyAuthRegister() {
  await driveToLimit("auth (register)", LIMIT, async (i) => {
    const response = await jsonRequest(credBase, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ email: `rl-register-${i}-${randomUUID()}@pramana.test`, password: "RateLimitPass2026", displayName: "Register Probe", organizationName: "Register Probe Org", projectName: "Register Probe Project", projectCode: `RLP-${i}-${Date.now()}`, timezone: "Asia/Kolkata" })
    });
    if (response.status === 201) registeredForCleanup.push(response.body.user.id, response.body.project.id, response.body.project.tenantId);
    return response;
  });
}

const registeredForCleanup: string[] = [];

async function verifyAuthLoginNoLeak(realEmail: string, realPassword: string) {
  // Real account, wrong password, from IP A.
  const realResult = await driveToLimit("auth (login, real account)", LIMIT, async () => {
    return jsonRequest(credBase, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.20" },
      body: JSON.stringify({ email: realEmail, password: "definitely-the-wrong-password" })
    });
  });
  // Nonexistent account, from IP B (isolated bucket so its own budget trips
  // independently of the real-account probe above).
  const fakeResult = await driveToLimit("auth (login, nonexistent account)", LIMIT, async () => {
    return jsonRequest(credBase, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.30" },
      body: JSON.stringify({ email: `nonexistent-${randomUUID()}@pramana.test`, password: "irrelevant-password" })
    });
  });
  assert.equal(realResult.status, fakeResult.status, "A real-account and nonexistent-account 429 must share the same HTTP status.");
  assert.equal(realResult.status, 429);
  // The bodies must match on everything except `retryAfter`, which is a TTL in
  // seconds and may tick down by one between the two independently-timed
  // request batches above -- that is wall-clock noise, not an account-existence
  // leak. Assert the leak-relevant fields are identical and retryAfter is a
  // same-shape, same-magnitude cooldown for both.
  assert.equal(realResult.body.error, fakeResult.body.error, "A real-account and nonexistent-account 429 error message must be identical.");
  assert.equal(Object.keys(realResult.body).sort().join(","), Object.keys(fakeResult.body).sort().join(","), "A real-account and nonexistent-account 429 body must have identical shape.");
  assert.ok(Math.abs(realResult.body.retryAfter - fakeResult.body.retryAfter) <= 2, `retryAfter must be within clock noise between the two probes (real=${realResult.body.retryAfter}, fake=${fakeResult.body.retryAfter}).`);
  console.log("  auth (login): real-account and nonexistent-account 429 responses are identical (aside from independent-clock retryAfter jitter).");
}

async function verifyAuthTotp(cookie: string, password: string) {
  await driveToLimit("auth (totp/enroll)", LIMIT, async () => {
    return jsonRequest(credBase, "/api/auth/totp/enroll", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ password })
    });
  });
}

async function main() {
  console.log("Building the application with Slice 3 rate-limit routes...");
  const build = spawnSync("npm", ["run", "build"], { cwd: root, env: sharedEnv, stdio: "inherit" });
  if (build.status !== 0) throw new Error("Production build failed; cannot exercise `next start` routes.");

  const development = start("node_modules/.bin/next", ["start", "-p", String(devPort)], devEnv);
  const credentials = start("node_modules/.bin/next", ["start", "-p", String(credPort)], credEnv);
  await waitFor(`${devBase}/api/health`, development);
  await waitFor(`${credBase}/api/health`, credentials);

  const projectId = randomUUID();
  const totpUserIds: string[] = [];
  try {
    console.log("Slice 3 rate-limit coverage verification:");

    await db.insert(projects).values({ id: projectId, tenantId: "10000000-0000-4000-8000-000000000001", name: "Rate Limit Coverage Project", code: `RLC-${projectId.slice(0, 8)}`, timezone: "Asia/Kolkata" });
    await db.insert(projectMembers).values({ projectId, userId: "10000000-0000-4000-8000-000000000002", role: "admin" });

    await verifySchedule(projectId);
    await verifyUpload(projectId);
    await verifyExport(projectId);
    await verifyKnowledge(projectId);

    await verifyAuthRegister();

    const realEmail = `rl-login-real-${randomUUID()}@pramana.test`;
    const realPassword = "RateLimitPass2026";
    const account = await registerAccount(realEmail, realPassword, "203.0.113.99");
    registeredForCleanup.push(account.user.id, account.project.id, account.project.tenantId);
    totpUserIds.push(account.user.id);
    await verifyAuthLoginNoLeak(realEmail, realPassword);

    const loginForTotp = await jsonRequest(credBase, "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.100" }, body: JSON.stringify({ email: realEmail, password: realPassword }) });
    assert.equal(loginForTotp.status, 200, `Setup login for the TOTP probe must succeed (got ${loginForTotp.status}).`);
    const setCookie = (loginForTotp.headers.get("set-cookie") ?? "").split(";")[0];
    assert.ok(setCookie, "Login must return an HttpOnly session cookie for the TOTP probe.");
    await verifyAuthTotp(setCookie, realPassword);

    console.log("Slice 3 rate-limit coverage verified: auth (login/register/totp), upload, schedule, export, and knowledge routes all return HTTP 429 with a retry hint past their budget, and the auth 429 never distinguishes a real account from a fake one.");
  } catch (error) {
    console.error("Verification failed:", error instanceof Error ? error.message : error);
    throw error;
  } finally {
    // Cleanup order matters: audit events and project members reference the
    // project and must go first, or the project delete hits a foreign-key
    // violation (the recurring cleanup-ordering bug this codebase has already
    // been bitten by -- see final_fix_plans.md's practical notes). Cleanup
    // failures are logged, not thrown, so they never mask a real assertion
    // failure from the try block above.
    try {
      await db.delete(durableJobs).where(eq(durableJobs.projectId, projectId));
      await db.delete(auditEvents).where(eq(auditEvents.projectId, projectId));
      await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
      await db.delete(projects).where(eq(projects.id, projectId));
      if (totpUserIds.length) await db.delete(authSessions).where(inArray(authSessions.userId, totpUserIds));
      const userIds = registeredForCleanup.filter((_, i) => i % 3 === 0);
      const projectIds = registeredForCleanup.filter((_, i) => i % 3 === 1);
      const tenantIds = registeredForCleanup.filter((_, i) => i % 3 === 2);
      if (userIds.length) await db.delete(authSessions).where(inArray(authSessions.userId, userIds));
      if (projectIds.length) await db.delete(durableJobs).where(inArray(durableJobs.projectId, projectIds));
      if (projectIds.length) await db.delete(auditEvents).where(inArray(auditEvents.projectId, projectIds));
      if (projectIds.length) await db.delete(projectMembers).where(inArray(projectMembers.projectId, projectIds));
      if (projectIds.length) await db.delete(projects).where(inArray(projects.id, projectIds));
      if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
      if (tenantIds.length) await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    } catch (cleanupError) {
      console.error("Cleanup failed (fixtures may need manual removal):", cleanupError instanceof Error ? cleanupError.message : cleanupError);
    }
    await stopChildren();
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); stopChildren().finally(() => process.exit(1)); });

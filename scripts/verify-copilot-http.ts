import { config } from "dotenv";
config({ path: ".env.local" });
config();

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { copilotTools } from "../src/lib/copilot/registry";
import { assembleSystemPrompt } from "../src/lib/copilot/context";
import { invokeTool } from "../src/lib/copilot/invoke";
import type { CopilotContext } from "../src/lib/copilot/types";
import { primaryWorkspaceLinks, workspaceGroups } from "../src/components/workspace-navigation";
import { developmentProjectId } from "../src/lib/demo";
import { db } from "../src/lib/db/client";
import { auditEvents, evidence, evidenceClaimLinks, evidenceClaims, findings, projectMembers, projects, systems, users } from "../src/lib/db/schema";
import { AccessError, requireProjectPermission } from "../src/lib/projects/access";
import { can } from "../src/lib/auth/roles";
import { verifyAuditChain } from "../src/lib/audit/verify-chain";
import { claimTypeValues } from "../src/lib/evidence/claim-taxonomy";

// Slice 13 — hardening for the Pramana Copilot tool registry. Assertions 1,
// 2, and 8 (Wave 1, A1-6) are structural/registry checks with no live
// dependency. Assertions 3-7 below need the real dev stack up (docker
// compose + `npm run dev`, AUTH_MODE=development) — see
// ChatbotHarnessPlan.md §7.6 for the environment notes. See §0 rules 2-6.

/**
 * Assertion 1 — Registry integrity (§0 rule 5, §2).
 *
 * Mechanically checkable today:
 *   (a) every registered tool declares a non-empty `permission`.
 *   (b) every `kind: "lib"` tool that is `mutating: true` declares a
 *       `rateLimit`.
 *
 * NOT checked here (explicitly out of scope, see report): the §2 nuance that
 * some non-mutating `kind: "lib"` tools wrap a function that does NOT
 * self-enforce and so should also carry a rateLimit (e.g. `answerKnowledgeQuery`,
 * `retrieveSemanticCitations`) even though they are read-only. The registry
 * has no field today that records "this lib function self-enforces" or
 * lists which library function a tool wraps, so that fact cannot be
 * recovered mechanically from `CopilotTool` alone — it lives only in the §2
 * table, which is a design-time authority, not registry data. Tightening
 * this is left to a later Wave 4 pass once that mapping exists in code (or
 * is added to this script by hand from the up-to-date §2 table).
 */
async function verifyRegistryIntegrity() {
  const tools = Object.values(copilotTools);
  assert.ok(tools.length > 0, "The copilot registry must export at least one tool.");

  for (const tool of tools) {
    assert.ok(
      typeof tool.permission === "string" && tool.permission.length > 0,
      `Tool "${tool.name}" must declare a non-empty permission.`
    );
  }

  for (const tool of tools) {
    if (tool.transport.kind === "lib" && tool.mutating === true) {
      assert.ok(
        tool.rateLimit !== undefined,
        `Mutating lib-transport tool "${tool.name}" must declare a rateLimit.`
      );
    }
  }

  console.log(
    `Registry integrity verified: ${tools.length} tool(s) all declare permission; ` +
      `mutating lib-transport tools all declare a rateLimit.`
  );
}

// §0 rule 3: review routes are off-limits for mutating methods. GET halves
// (review.advisory, Slice 7) are explicitly allowed and must NOT be flagged.
const FORBIDDEN_MUTATING_SUFFIXES = [/\/review$/, /\/report\/approve$/];
const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// §0 rule 4: gate approval is off-limits for every method — there is no
// allowed half.
const GATE_DECISIONS_PATTERN = /^\/api\/gates\/[^/]+\/decisions$/;

/** A generous fake-args bag so any plausible tool path() function resolves without throwing. */
const FAKE_PATH_ARGS = {
  id: "test-id",
  projectId: "test-project",
  gateId: "test-gate",
  findingId: "test-finding",
  documentId: "test-document",
  shipmentId: "test-shipment",
  checklistId: "test-checklist",
  stepId: "test-step",
  taskId: "test-task",
  resourceId: "test-resource",
  riskId: "test-risk",
  jobId: "test-job",
  conversationId: "test-conversation",
  subjectId: "test-subject",
  subjectType: "test-subject-type"
};

/**
 * Assertion 2 — Forbidden routes (§0 rules 3 and 4).
 *
 * Only HTTP-transport tools have a concrete path; lib-transport tools are
 * skipped (they have no route to check). Each tool's `path()` is invoked
 * with a generous fake-args object; a tool whose path function throws on
 * these args is reported and skipped rather than failing the whole script.
 */
async function verifyForbiddenRoutes() {
  const tools = Object.values(copilotTools);
  const httpTools = tools.filter((tool) => tool.transport.kind === "http");
  const skipped: string[] = [];
  let checked = 0;

  for (const tool of httpTools) {
    if (tool.transport.kind !== "http") continue;
    let path: string;
    try {
      path = tool.transport.path(FAKE_PATH_ARGS);
    } catch {
      skipped.push(tool.name);
      continue;
    }
    checked += 1;
    const method = tool.transport.method.toUpperCase();

    assert.ok(
      !GATE_DECISIONS_PATTERN.test(path),
      `Tool "${tool.name}" (${method} ${path}) must never target a gate decisions route (§0 rule 4).`
    );

    if (MUTATING_METHODS.has(method)) {
      for (const suffix of FORBIDDEN_MUTATING_SUFFIXES) {
        assert.ok(
          !suffix.test(path),
          `Tool "${tool.name}" (${method} ${path}) must never mutate a review route (§0 rule 3).`
        );
      }
    }
  }

  console.log(
    `Forbidden routes verified: ${checked} HTTP-transport tool(s) checked against review-route ` +
      `mutation and gate-decisions patterns` +
      (skipped.length > 0 ? ` (skipped, path() threw on fake args: ${skipped.join(", ")})` : ".")
  );
}

/**
 * Assertion 8 — Prompt budget (Slice 3.2).
 *
 * Calls the real `assembleSystemPrompt` for every workspace route with the
 * real seeded dev project id, and asserts every resulting prompt is
 * <= 45 000 characters.
 */
async function verifyPromptBudget() {
  const allLinks = [...primaryWorkspaceLinks, ...workspaceGroups.flatMap((group) => group.links)];
  const pathnames = Array.from(new Set(allLinks.map(([, , href]) => href)));
  assert.ok(pathnames.length > 0, "At least one workspace route must be discoverable from workspace-navigation.tsx.");

  const lengths: { pathname: string; length: number }[] = [];
  for (const pathname of pathnames) {
    const prompt = await assembleSystemPrompt({
      projectId: developmentProjectId,
      pathname,
      searchParams: {}
    });
    lengths.push({ pathname, length: prompt.length });
    assert.ok(
      prompt.length <= 45_000,
      `Assembled system prompt for "${pathname}" must be <= 45000 chars (got ${prompt.length}).`
    );
  }

  const max = lengths.reduce((a, b) => (b.length > a.length ? b : a));
  console.log(
    `Prompt budget verified: ${pathnames.length} workspace route(s) all produced a system prompt ` +
      `<= 45000 chars (largest: "${max.pathname}" at ${max.length} chars).`
  );
}

// The seeded development identity (src/lib/auth/roles.ts's `developmentIdentity`)
// resolves, under AUTH_MODE=development, to whichever `users` row has this
// email — see src/lib/auth/user.ts. `requireProjectPermission` always
// re-resolves the caller this way regardless of what a constructed
// `CopilotContext.userId` says (A2-3's documented gotcha), so assertions 3-7
// below grant/revoke this real user's membership on a throwaway project
// rather than trying to impersonate a different actor.
const DEV_USER_EMAIL = "manager@pramana.local";
// Matches the tenant every other verify-*-http.ts script's throwaway
// projects use (e.g. scripts/verify-schedule-http.ts).
const TEST_TENANT_ID = "10000000-0000-4000-8000-000000000001";

async function setupLiveTestProject() {
  const user = await db.query.users.findFirst({ where: eq(users.email, DEV_USER_EMAIL) });
  assert.ok(user, `Seeded development user "${DEV_USER_EMAIL}" must exist — run npm run db:seed.`);
  const projectId = randomUUID();
  await db.insert(projects).values({
    id: projectId,
    tenantId: TEST_TENANT_ID,
    name: "Copilot Hardening Verification",
    code: `CHV-${projectId.slice(0, 8)}`,
    timezone: "Asia/Kolkata"
  });
  // Starts as "viewer" — the weakest role, and exactly what assertion 3 needs.
  await db.insert(projectMembers).values({ projectId, userId: user!.id, role: "viewer" });
  return { projectId, userId: user!.id };
}

async function teardownLiveTestProject(projectId: string) {
  const claimRows = await db.select({ id: evidenceClaims.id }).from(evidenceClaims).where(eq(evidenceClaims.projectId, projectId));
  for (const claim of claimRows) await db.delete(evidenceClaimLinks).where(eq(evidenceClaimLinks.claimId, claim.id));
  await db.delete(evidenceClaims).where(eq(evidenceClaims.projectId, projectId));
  await db.delete(evidence).where(eq(evidence.projectId, projectId));
  await db.delete(systems).where(eq(systems.projectId, projectId));
  await db.delete(findings).where(eq(findings.projectId, projectId));
  await db.delete(auditEvents).where(eq(auditEvents.projectId, projectId));
  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
}

const testCtx = (projectId: string, userId: string, role: CopilotContext["role"]): CopilotContext => ({
  projectId,
  userId,
  role,
  conversationId: randomUUID(),
  cookieHeader: "",
  clientIp: "127.0.0.1",
  pathname: "/command-center",
  searchParams: {}
});

/**
 * Assertion 3 — Permission enforcement (§0 rule 5, §2).
 *
 * (a) A structural sweep: `requireProjectPermission` — the exact function
 *     `invokeTool` calls before dispatching, for both transports (§2's
 *     trap) — must match the real grants table (`can()`, src/lib/auth/roles.ts)
 *     for a viewer-role actor on every registered mutating tool's declared
 *     permission. Most mutating tools require a permission a viewer does not
 *     hold and must be denied; a few (e.g. `export.project`, permission
 *     `audit:view`, which every role including viewer holds — Slice 10's own
 *     table) are correctly allowed. The point of §0 rule 5 is that a tool
 *     never grants more than its declared permission already allows, not
 *     that "mutating" alone implies "viewer-proof" — this sweep checks
 *     exactly that: every tool's *declared* permission is enforced, neither
 *     widened nor over-restricted.
 * (b) Two live spot checks through the real `invokeTool` entry point, for
 *     tools a viewer genuinely lacks permission for, one per transport kind,
 *     confirming a denied call never reaches `execute()` (an HTTP-transport
 *     tool would otherwise make a real network call on fabricated args).
 */
async function verifyPermissionEnforcement(projectId: string, userId: string) {
  const mutatingTools = Object.values(copilotTools).filter((tool) => tool.mutating);
  assert.ok(mutatingTools.length > 0, "At least one mutating tool must be registered to test permission enforcement.");

  let denied = 0;
  let allowed = 0;
  for (const tool of mutatingTools) {
    if (can("viewer", tool.permission)) {
      const actor = await requireProjectPermission(projectId, tool.permission);
      assert.equal(actor.role, "viewer", `Tool "${tool.name}" (permission "${tool.permission}", which viewer holds) unexpectedly resolved a different role.`);
      allowed += 1;
    } else {
      await assert.rejects(
        () => requireProjectPermission(projectId, tool.permission),
        (error: unknown) => error instanceof AccessError,
        `Tool "${tool.name}" (permission "${tool.permission}", which viewer does not hold) must deny a viewer-role actor.`
      );
      denied += 1;
    }
  }

  const ctx = testCtx(projectId, userId, "viewer");
  const httpDenial = await invokeTool(ctx, "findings.create", {
    title: "Should never be created", severity: "low", ownerId: randomUUID(), dueAt: new Date(Date.now() + 86_400_000).toISOString()
  });
  assert.equal(httpDenial.ok, false);
  assert.equal(httpDenial.status, 403, `findings.create (HTTP transport) must return 403 for a viewer, got ${JSON.stringify(httpDenial)}`);

  const libDenial = await invokeTool(ctx, "compliance.check_one", { requirementId: randomUUID(), targetSourceRegionId: randomUUID() });
  assert.equal(libDenial.ok, false);
  assert.equal(libDenial.status, 403, `compliance.check_one (lib transport) must return 403 for a viewer, got ${JSON.stringify(libDenial)}`);

  console.log(
    `Permission enforcement verified: ${mutatingTools.length} mutating tool(s) checked against the real grants ` +
      `table for a viewer-role actor (${denied} correctly denied, ${allowed} correctly allowed under permissions ` +
      "viewer already holds) plus 2 live invokeTool spot checks (HTTP + lib transport) confirming denial short-circuits before execute()."
  );
}

/**
 * Assertion 4 — Non-final states (§0 rule 2) + Assertion 5 — Audit chain.
 *
 * Live-round-trips the two cheapest, self-contained create tools
 * (findings.create, claims.create) through the real invokeTool -> HTTP/lib
 * -> route path and confirms the record comes back in its documented
 * non-final state. The remaining create-shaped tools named in §0 rule 2
 * (compliance.*, cx.generate_checklist, shipment_plans.act) need in-project
 * fixtures this script does not seed (an accepted requirement, a completed
 * standard, an approved Site Analysis package) — those are schema-checked
 * instead: none of them exposes an input key that could let the model set
 * the resulting record's review/validity/status field directly at creation.
 * Same scoping style as assertion 1's own documented gap.
 */
async function verifyNonFinalStatesAndAudit(projectId: string, userId: string) {
  await db.update(projectMembers).set({ role: "admin" }).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  const ctx = testCtx(projectId, userId, "admin");

  const findingResult = await invokeTool(ctx, "findings.create", {
    title: "Slice 13 verification finding", severity: "medium", ownerId: userId, dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString()
  });
  assert.ok(findingResult.ok, `findings.create must succeed for an admin actor: ${findingResult.error}`);
  const finding = (findingResult.data as { finding: { status: string } }).finding;
  assert.equal(finding.status, "open", "A finding created through the copilot must land in status \"open\", never a terminal state.");

  const [system] = await db.insert(systems).values({ projectId, name: `Copilot verification system ${Date.now()}`, systemType: "verification" }).returning();
  const [evidenceRow] = await db.insert(evidence).values({ projectId, systemId: system.id, evidenceType: "photo", capturedBy: userId, capturedAt: new Date() }).returning();
  const claimResult = await invokeTool(ctx, "claims.create", {
    claimType: claimTypeValues[0], metricKey: "verification-metric",
    statement: "Slice 13 hardening verification claim statement, long enough to pass validation.",
    evidenceIds: [evidenceRow.id]
  });
  assert.ok(claimResult.ok, `claims.create must succeed for an admin actor: ${claimResult.error}`);
  const claim = (claimResult.data as { claim: { status: string } }).claim;
  assert.equal(claim.status, "proposed", "A claim created through the copilot must land in status \"proposed\", never a terminal state.");

  const otherCreateTools = ["compliance.check_one", "compliance.scan", "cx.generate_checklist", "shipment_plans.act"] as const;
  const forbiddenInputKeys = new Set(["status", "reviewState", "validityState", "approve", "approved"]);
  for (const name of otherCreateTools) {
    const tool = copilotTools[name];
    assert.ok(tool, `Expected tool "${name}" to be registered.`);
    if (tool.input instanceof z.ZodObject) {
      for (const key of Object.keys(tool.input.shape)) {
        assert.ok(!forbiddenInputKeys.has(key), `Tool "${name}" must not expose a "${key}" input — it would let the model set a non-final-state field directly.`);
      }
    }
  }

  const auditResult = await verifyAuditChain(projectId);
  assert.ok(auditResult.valid, `Audit chain must stay valid after a copilot write session: ${auditResult.errors.join(" ")}`);
  assert.ok(auditResult.eventCount >= 2, `Expected at least 2 audit events (findings.create + claims.create), got ${auditResult.eventCount}.`);

  console.log(
    `Non-final states verified: findings.create -> "open", claims.create -> "proposed"; ${otherCreateTools.length} ` +
      "further create tool(s) schema-checked for no direct terminal-state override. " +
      `Audit chain valid for ${auditResult.eventCount} event(s) after the write session.`
  );
}

/**
 * Assertion 6 — Groundedness (§0 rule 6).
 *
 * The throwaway test project has zero controlled sources, so
 * `answerKnowledgeQuery` (via the `knowledge.search` tool) is guaranteed to
 * retrieve nothing and return `noResults: true` regardless of the
 * configured model provider's behavior on its planning call — that call is
 * itself wrapped in a `.catch()` fallback in src/lib/knowledge/pipeline.ts,
 * so a slow/unavailable real provider degrades rather than fails this check
 * (it may simply take up to MODEL_TIMEOUT_MS before falling back).
 */
async function verifyGroundedness(projectId: string, userId: string) {
  const ctx = testCtx(projectId, userId, "admin");
  const result = await invokeTool(ctx, "knowledge.search", { query: "What is the chilled water system commissioning status?" });
  assert.ok(result.ok, `knowledge.search must succeed (even with no results): ${result.error}`);
  const data = result.data as { noResults: boolean; answer: string | null; claims: unknown[] };
  assert.equal(data.noResults, true, "A project with zero controlled sources must report noResults: true.");
  assert.equal(data.answer, null, "noResults: true must never carry a fabricated answer string.");
  assert.equal(data.claims.length, 0, "noResults: true must never carry fabricated claims.");
  console.log("Groundedness verified: knowledge.search on a project with zero controlled sources returns noResults:true with no answer and no claims.");
}

/**
 * Assertion 7 — Mock determinism (Slice 4 instruction 2).
 *
 * `env.MODEL_PROVIDER` (src/lib/env.ts) is parsed once per process from
 * `process.env`, so this process (already configured for the real provider)
 * cannot itself exercise `MODEL_PROVIDER=mock`. Spawns
 * scripts/verify-copilot-mock-turn.ts as its own `tsx` process with
 * `MODEL_PROVIDER=mock` forced in the child environment; that file runs one
 * real `runCopilotTurn`, self-cleans its own conversation row, and prints
 * one JSON line this function asserts against.
 */
function verifyMockDeterminism(projectId: string, userId: string, role: string) {
  const helperPath = path.join(__dirname, "verify-copilot-mock-turn.ts");
  const result = spawnSync("npx", ["--no-install", "tsx", helperPath], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, MODEL_PROVIDER: "mock", COPILOT_MOCK_TEST_PROJECT_ID: projectId, COPILOT_MOCK_TEST_USER_ID: userId, COPILOT_MOCK_TEST_ROLE: role },
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  assert.equal(result.status, 0, `Mock-turn subprocess must exit 0 (stderr: ${result.stderr}, stdout: ${result.stdout})`);
  const lines = result.stdout.trim().split("\n");
  const parsed = JSON.parse(lines[lines.length - 1]) as {
    envelope: { summary: string; detail: string | null; citations: unknown[]; actions: unknown[]; renders: unknown[]; authority: string };
    toolMessageCount: number;
  };
  const { envelope, toolMessageCount } = parsed;
  assert.equal(envelope.detail, null, "MODEL_PROVIDER=mock must degrade to the deterministic done step with detail: null.");
  assert.deepEqual(envelope.citations, [], "Mock determinism must not fabricate citations.");
  assert.deepEqual(envelope.actions, [], "Mock determinism must not report any action.");
  assert.deepEqual(envelope.renders, [], "Mock determinism must not render anything — no tool was called.");
  assert.equal(envelope.authority, "advisory", "An untouched mock turn must report authority: \"advisory\".");
  assert.equal(toolMessageCount, 0, "MODEL_PROVIDER=mock must never invoke a tool.");
  console.log(`Mock determinism verified: a turn under MODEL_PROVIDER=mock returned the deterministic done envelope ("${envelope.summary}") and invoked zero tools.`);
}

async function verifyLiveAssertions() {
  const { projectId, userId } = await setupLiveTestProject();
  try {
    await verifyPermissionEnforcement(projectId, userId);
    await verifyNonFinalStatesAndAudit(projectId, userId);
    await verifyGroundedness(projectId, userId);
    verifyMockDeterminism(projectId, userId, "admin");
  } finally {
    await teardownLiveTestProject(projectId);
  }
}

async function main() {
  console.log("Copilot hardening verification (assertions 1-8):");
  await verifyRegistryIntegrity();
  await verifyForbiddenRoutes();
  await verifyPromptBudget();
  await verifyLiveAssertions();
  console.log(
    "Copilot verification passed: registry integrity, forbidden routes, prompt budget, permission " +
      "enforcement, non-final states, audit chain, groundedness, and mock determinism all hold."
  );
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

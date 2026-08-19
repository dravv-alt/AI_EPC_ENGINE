import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Slice 1: named, overridable target constants. This is a pure unit-level tracer — no
// database, no network, no containers — so it must pass in every environment, including
// CI with zero secrets configured.
//
// Each assertion below spawns a fresh child process with tsx so that `src/lib/env.ts`
// (which parses `process.env` once at module load) re-evaluates against a controlled
// environment instead of whatever this script's own process happens to hold.

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TARGETS_MODULE = path.join(PROJECT_ROOT, "src", "lib", "config", "targets.ts");

function readTargets(overrides: Record<string, string | undefined>): Record<string, unknown> {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "verify-config-targets-"));
  const entryFile = path.join(tmpDir, "print-targets.ts");
  const importPath = TARGETS_MODULE.replace(/\\/g, "/");
  writeFileSync(
    entryFile,
    `import * as targets from "${importPath}";\nconsole.log(JSON.stringify(targets));\n`
  );
  try {
    const env = { ...process.env, ...overrides };
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const stdout = execFileSync(npxCmd, ["tsx", entryFile], {
      cwd: PROJECT_ROOT,
      env,
      shell: true,
      encoding: "utf-8"
    });
    const lastLine = stdout.trim().split("\n").pop() ?? "{}";
    return JSON.parse(lastLine);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function expectRejection(overrides: Record<string, string | undefined>, label: string): void {
  assert.throws(
    () => readTargets(overrides),
    (error: unknown) => error instanceof Error,
    `${label}: an out-of-range override must be rejected by the Zod schema, not silently accepted.`
  );
}

async function main() {
  // 1. Every constant resolves to its documented default with no overrides set.
  const defaults = readTargets({
    COMPLIANCE_DEVIATION_ACCURACY_TARGET: undefined,
    RISK_LEAD_TIME_TARGET_HOURS: undefined,
    RFI_MATCH_ACCURACY_TARGET: undefined,
    HIGH_SEVERITY_PRECISION_TARGET: undefined,
    PACK_PREP_TIME_REDUCTION_TARGET: undefined,
    SOLVER_TIMEOUT_MS: undefined,
    SOLVER_MAX_ATTEMPTS: undefined
  });
  assert.equal(defaults.COMPLIANCE_DEVIATION_ACCURACY_TARGET, 0.95, "COMPLIANCE_DEVIATION_ACCURACY_TARGET must default to 0.95.");
  assert.equal(defaults.RISK_LEAD_TIME_TARGET, 48, "RISK_LEAD_TIME_TARGET must default to 48 hours.");
  assert.equal(defaults.RFI_MATCH_ACCURACY_TARGET, 0.85, "RFI_MATCH_ACCURACY_TARGET must default to 0.85.");
  assert.equal(defaults.HIGH_SEVERITY_PRECISION_TARGET, 0.9, "HIGH_SEVERITY_PRECISION_TARGET must default to 0.9.");
  assert.equal(defaults.PACK_PREP_TIME_REDUCTION_TARGET, 0.6, "PACK_PREP_TIME_REDUCTION_TARGET must default to 0.6.");
  // Tracer: SOLVER_TIMEOUT_MS resolves to 90000 by default.
  assert.equal(defaults.SOLVER_TIMEOUT_MS, 90_000, "SOLVER_TIMEOUT_MS must default to 90000ms per Rules.md line 33.");
  assert.equal(defaults.SOLVER_MAX_ATTEMPTS, 3, "SOLVER_MAX_ATTEMPTS must default to 3.");

  // 2. An env override is respected for every constant.
  const overridden = readTargets({
    COMPLIANCE_DEVIATION_ACCURACY_TARGET: "0.8",
    RISK_LEAD_TIME_TARGET_HOURS: "72",
    RFI_MATCH_ACCURACY_TARGET: "0.7",
    HIGH_SEVERITY_PRECISION_TARGET: "0.75",
    PACK_PREP_TIME_REDUCTION_TARGET: "0.5",
    SOLVER_TIMEOUT_MS: "45000",
    SOLVER_MAX_ATTEMPTS: "5"
  });
  assert.equal(overridden.COMPLIANCE_DEVIATION_ACCURACY_TARGET, 0.8, "COMPLIANCE_DEVIATION_ACCURACY_TARGET override must be respected.");
  assert.equal(overridden.RISK_LEAD_TIME_TARGET, 72, "RISK_LEAD_TIME_TARGET override must be respected.");
  assert.equal(overridden.RFI_MATCH_ACCURACY_TARGET, 0.7, "RFI_MATCH_ACCURACY_TARGET override must be respected.");
  assert.equal(overridden.HIGH_SEVERITY_PRECISION_TARGET, 0.75, "HIGH_SEVERITY_PRECISION_TARGET override must be respected.");
  assert.equal(overridden.PACK_PREP_TIME_REDUCTION_TARGET, 0.5, "PACK_PREP_TIME_REDUCTION_TARGET override must be respected.");
  // Tracer: SOLVER_TIMEOUT_MS resolves to an override when the env var is set.
  assert.equal(overridden.SOLVER_TIMEOUT_MS, 45_000, "SOLVER_TIMEOUT_MS override must be respected.");
  assert.equal(overridden.SOLVER_MAX_ATTEMPTS, 5, "SOLVER_MAX_ATTEMPTS override must be respected.");

  // 3. An out-of-range override is rejected by the Zod schema rather than silently accepted.
  expectRejection({ COMPLIANCE_DEVIATION_ACCURACY_TARGET: "1.5" }, "COMPLIANCE_DEVIATION_ACCURACY_TARGET > 1");
  expectRejection({ RISK_LEAD_TIME_TARGET_HOURS: "-5" }, "RISK_LEAD_TIME_TARGET_HOURS negative");
  expectRejection({ RFI_MATCH_ACCURACY_TARGET: "2" }, "RFI_MATCH_ACCURACY_TARGET > 1");
  expectRejection({ HIGH_SEVERITY_PRECISION_TARGET: "-0.1" }, "HIGH_SEVERITY_PRECISION_TARGET negative");
  expectRejection({ PACK_PREP_TIME_REDUCTION_TARGET: "3" }, "PACK_PREP_TIME_REDUCTION_TARGET > 1");
  expectRejection({ SOLVER_TIMEOUT_MS: "500" }, "SOLVER_TIMEOUT_MS below 1000ms floor");
  expectRejection({ SOLVER_MAX_ATTEMPTS: "0" }, "SOLVER_MAX_ATTEMPTS below 1");

  console.log("Config targets verified: every named constant resolves to its documented default, respects an env override, and rejects an out-of-range override.");
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });

/**
 * DEVELOPMENT SEED — Pramana Cx
 *
 * Populates a realistic Mumbai DC-07 EPC project with data across every
 * feature surface so the app is immediately usable after `npm run db:seed`.
 *
 * Coverage:
 *  - Tenant + 3 users (admin, field engineer, approver)
 *  - Project: Mumbai DC-07 with 4 systems, 10 assets, 5 gates
 *  - 3 controlled documents (procedure + 2 standards) with source regions
 *  - 10 requirements across states: accepted, proposed, rejected
 *  - Evidence records: accepted, pending, stale
 *  - Graph edges: PROVES + AFFECTS
 *  - Findings: open high, open medium, in-progress critical, closed
 *  - Cx: checklist with steps + a test record with results (pass + fail)
 *  - Compliance checks: numeric deviation + qualitative
 *  - Schedule: tasks, resources, dependencies, 1 solved version + assignments
 *  - Risk signals + a schedule risk record
 *  - 2 shipments: green + delayed (amber)
 *  - Alerts: TEST_FAILED + SHIPMENT_DELAYED
 *  - Knowledge chunks for 3 source regions
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db/client";
import {
  alerts,
  assets,
  complianceChecks,
  cxChecklistSteps,
  cxChecklists,
  cxClauseCitations,
  cxStepResults,
  cxTestRecords,
  documentVersions,
  documents,
  edges,
  evidence,
  findings,
  gates,
  knowledgeChunks,
  projectMembers,
  projects,
  requirements,
  riskSignals,
  scheduleAssignments,
  scheduleDependencies,
  scheduleResources,
  scheduleRisks,
  scheduleTaskResources,
  scheduleTasks,
  scheduleVersions,
  shipments,
  sourceRegions,
  systems,
  tenants,
  users,
} from "../src/lib/db/schema";

// ---------------------------------------------------------------------------
// Stable UUIDs — every entity uses a deterministic ID so re-running the seed
// is fully idempotent (onConflictDoNothing / onConflictDoUpdate throughout).
// ---------------------------------------------------------------------------
const T = {
  tenant:       "10000000-0000-4000-8000-000000000001",
  user_admin:   "10000000-0000-4000-8000-000000000002",
  user_field:   "10000000-0000-4000-8000-000000000003",
  user_approver:"10000000-0000-4000-8000-000000000004",
  user_clerk_test:"10000000-0000-4000-8000-000000000005",
  user_clerk_owner:"10000000-0000-4000-8000-000000000006",

  // This is the original Refinement project UUID. Changing it would cause the
  // project-code conflict to skip insertion and leave every later FK invalid.
  project:      "10000000-0000-4000-8000-000000000003",

  // Systems
  sys_chw:      "10000000-0000-4000-8000-000000000020",
  sys_elec:     "10000000-0000-4000-8000-000000000021",
  sys_fire:     "10000000-0000-4000-8000-000000000022",
  sys_hvac:     "10000000-0000-4000-8000-000000000023",

  // Assets
  asset_chwp02: "10000000-0000-4000-8000-000000000030",
  asset_chwp03: "10000000-0000-4000-8000-000000000031",
  asset_mcc01:  "10000000-0000-4000-8000-000000000032",
  asset_ups01:  "10000000-0000-4000-8000-000000000033",
  asset_fm200:  "10000000-0000-4000-8000-000000000034",
  asset_ahu01:  "10000000-0000-4000-8000-000000000035",
  asset_ahu02:  "10000000-0000-4000-8000-000000000036",
  asset_crac01: "10000000-0000-4000-8000-000000000037",
  asset_gen01:  "10000000-0000-4000-8000-000000000038",
  asset_pdu01:  "10000000-0000-4000-8000-000000000039",

  // Gates
  gate_l1:      "10000000-0000-4000-8000-000000000040",
  gate_l2:      "10000000-0000-4000-8000-000000000041",
  gate_l3:      "10000000-0000-4000-8000-000000000042",
  gate_l4:      "10000000-0000-4000-8000-000000000043",
  gate_l5:      "10000000-0000-4000-8000-000000000044",

  // Documents
  doc_chw_proc: "10000000-0000-4000-8000-000000000050",
  doc_ashrae:   "10000000-0000-4000-8000-000000000051",
  doc_nfpa:     "10000000-0000-4000-8000-000000000052",

  // Document versions
  ver_chw_prev: "10000000-0000-4000-8000-000000000063",
  ver_chw_proc: "10000000-0000-4000-8000-000000000060",
  ver_ashrae:   "10000000-0000-4000-8000-000000000061",
  ver_nfpa:     "10000000-0000-4000-8000-000000000062",

  // Source regions
  reg_r1:       "10000000-0000-4000-8000-000000000070",
  reg_r2:       "10000000-0000-4000-8000-000000000071",
  reg_r3:       "10000000-0000-4000-8000-000000000072",
  reg_r4:       "10000000-0000-4000-8000-000000000073",
  reg_r5:       "10000000-0000-4000-8000-000000000074",
  reg_r6:       "10000000-0000-4000-8000-000000000075",
  reg_prev_r1:  "10000000-0000-4000-8000-000000000076",

  // Requirements
  req_r1:       "10000000-0000-4000-8000-000000000080",
  req_r2:       "10000000-0000-4000-8000-000000000081",
  req_r3:       "10000000-0000-4000-8000-000000000082",
  req_r4:       "10000000-0000-4000-8000-000000000083",
  req_r5:       "10000000-0000-4000-8000-000000000084",
  req_r6:       "10000000-0000-4000-8000-000000000085",
  req_r7:       "10000000-0000-4000-8000-000000000086",
  req_r8:       "10000000-0000-4000-8000-000000000087",
  req_r9:       "10000000-0000-4000-8000-000000000088",
  req_r10:      "10000000-0000-4000-8000-000000000089",
  req_prev_r1:  "10000000-0000-4000-8000-00000000008A",

  // Evidence
  evid_e1:      "10000000-0000-4000-8000-000000000090",
  evid_e2:      "10000000-0000-4000-8000-000000000091",
  evid_e3:      "10000000-0000-4000-8000-000000000092",
  evid_e4:      "10000000-0000-4000-8000-000000000093",
  evid_e5:      "10000000-0000-4000-8000-000000000094",

  // Findings
  find_f1:      "10000000-0000-4000-8000-0000000000A0",
  find_f2:      "10000000-0000-4000-8000-0000000000A1",
  find_f3:      "10000000-0000-4000-8000-0000000000A2",
  find_f4:      "10000000-0000-4000-8000-0000000000A3",

  // Cx
  cx_checklist: "10000000-0000-4000-8000-0000000000B0",
  cx_step1:     "10000000-0000-4000-8000-0000000000B1",
  cx_step2:     "10000000-0000-4000-8000-0000000000B2",
  cx_step3:     "10000000-0000-4000-8000-0000000000B3",
  cx_step4:     "10000000-0000-4000-8000-0000000000B4",
  cx_citation1: "10000000-0000-4000-8000-0000000000B5",
  cx_citation2: "10000000-0000-4000-8000-0000000000B6",
  cx_record:    "10000000-0000-4000-8000-0000000000B7",
  cx_result1:   "10000000-0000-4000-8000-0000000000B8",
  cx_result2:   "10000000-0000-4000-8000-0000000000B9",
  cx_result3:   "10000000-0000-4000-8000-0000000000BA",

  // Compliance
  comp_c1:      "10000000-0000-4000-8000-0000000000C0",
  comp_c2:      "10000000-0000-4000-8000-0000000000C1",

  // Schedule
  sched_res1:   "10000000-0000-4000-8000-0000000000D0",
  sched_res2:   "10000000-0000-4000-8000-0000000000D1",
  sched_task1:  "10000000-0000-4000-8000-0000000000D2",
  sched_task2:  "10000000-0000-4000-8000-0000000000D3",
  sched_task3:  "10000000-0000-4000-8000-0000000000D4",
  sched_task4:  "10000000-0000-4000-8000-0000000000D5",
  sched_task5:  "10000000-0000-4000-8000-0000000000D6",
  sched_dep1:   "10000000-0000-4000-8000-0000000000D7",
  sched_dep2:   "10000000-0000-4000-8000-0000000000D8",
  sched_dep3:   "10000000-0000-4000-8000-0000000000D9",
  sched_ver1:   "10000000-0000-4000-8000-0000000000DA",
  sched_asgn1:  "10000000-0000-4000-8000-0000000000DB",
  sched_asgn2:  "10000000-0000-4000-8000-0000000000DC",
  sched_asgn3:  "10000000-0000-4000-8000-0000000000DD",
  sched_asgn4:  "10000000-0000-4000-8000-0000000000DE",
  sched_asgn5:  "10000000-0000-4000-8000-0000000000DF",
  risk_sig1:    "10000000-0000-4000-8000-0000000000E0",
  risk_rec1:    "10000000-0000-4000-8000-0000000000E1",

  // Shipments
  ship_s1:      "10000000-0000-4000-8000-0000000000F0",
  ship_s2:      "10000000-0000-4000-8000-0000000000F1",

  // Alerts
  alert_a1:     "10000000-0000-4000-8000-000000000100",
  alert_a2:     "10000000-0000-4000-8000-000000000101",

  // Graph edges (stable IDs so PK conflict fires on re-seed)
  edge_req1_gate4:   "10000000-0000-4000-8000-000000000110",
  edge_req2_gate3:   "10000000-0000-4000-8000-000000000111",
  edge_req3_gate4:   "10000000-0000-4000-8000-000000000112",
  edge_req4_gate2:   "10000000-0000-4000-8000-000000000113",
  edge_req5_gate5:   "10000000-0000-4000-8000-000000000114",
  edge_req6_gate3:   "10000000-0000-4000-8000-000000000115",
  edge_evid1_req1:   "10000000-0000-4000-8000-000000000116",
  edge_evid2_req2:   "10000000-0000-4000-8000-000000000117",
  edge_evid5_req5:   "10000000-0000-4000-8000-000000000118",
  edge_gate1_gate2:  "10000000-0000-4000-8000-000000000119",
  edge_gate2_gate3:  "10000000-0000-4000-8000-00000000011A",
  edge_gate3_gate4:  "10000000-0000-4000-8000-00000000011B",
  edge_prev_req_gate4:"10000000-0000-4000-8000-00000000011C",
  edge_evid1_prev_req:"10000000-0000-4000-8000-00000000011D",

  // Knowledge chunks (stable IDs so PK conflict fires on re-seed)
  kc_1:         "10000000-0000-4000-8000-000000000120",
  kc_3:         "10000000-0000-4000-8000-000000000121",
  kc_5:         "10000000-0000-4000-8000-000000000122",
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Reference dates relative to "now" for realistic-looking data
// ---------------------------------------------------------------------------
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000);

async function seed() {
  console.log("🌱  Seeding Pramana Cx development data …\n");

  // ── Tenant ────────────────────────────────────────────────────────────────
  await db.insert(tenants).values({
    id: T.tenant,
    name: "Pramana Demo Org",
  }).onConflictDoNothing();
  console.log("  ✓ Tenant");

  // ── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Pramana@123!", 10);
  await db.insert(users).values([
    // NOTE: email must match developmentIdentity in src/lib/auth/roles.ts for AUTH_MODE=development
    { id: T.user_admin,    email: "manager@pramana.local",  displayName: "Aarav Mehta",     passwordHash },
    { id: T.user_field,    email: "field@pramana.local",    displayName: "Priya Sharma",    passwordHash },
    { id: T.user_approver, email: "approver@pramana.local", displayName: "Rohan Desai",     passwordHash },
    { id: T.user_clerk_test, email: "testbeta@ipdkimkc.com", displayName: "Test Beta" },
    { id: T.user_clerk_owner, email: "atharva.v.deo@gmail.com", displayName: "Atharva Deo" },
  ]).onConflictDoNothing();
  console.log("  ✓ Users (admin, field, approver, Clerk test + owner) — password: Pramana@123!");

  // ── Project ───────────────────────────────────────────────────────────────
  await db.insert(projects).values({
    id: T.project,
    tenantId: T.tenant,
    name: "Mumbai DC-07",
    code: "MDC-07",
    timezone: "Asia/Kolkata",
  }).onConflictDoNothing();

  await db.insert(projectMembers).values([
    { projectId: T.project, userId: T.user_admin,    role: "admin" },
    { projectId: T.project, userId: T.user_field,    role: "field_engineer" },
    { projectId: T.project, userId: T.user_approver, role: "approver" },
    { projectId: T.project, userId: T.user_clerk_test, role: "viewer" },
    { projectId: T.project, userId: T.user_clerk_owner, role: "admin" },
  ]).onConflictDoNothing();
  console.log("  ✓ Project: Mumbai DC-07 (MDC-07)");

  // ── Systems ───────────────────────────────────────────────────────────────
  await db.insert(systems).values([
    { id: T.sys_chw,  projectId: T.project, name: "Chilled Water",         systemType: "cooling" },
    { id: T.sys_elec, projectId: T.project, name: "Electrical Distribution", systemType: "electrical" },
    { id: T.sys_fire, projectId: T.project, name: "Fire Suppression",       systemType: "fire" },
    { id: T.sys_hvac, projectId: T.project, name: "HVAC & Precision Cooling", systemType: "hvac" },
  ]).onConflictDoNothing();
  console.log("  ✓ Systems (CHW, Electrical, Fire, HVAC)");

  // ── Assets ────────────────────────────────────────────────────────────────
  await db.insert(assets).values([
    { id: T.asset_chwp02, projectId: T.project, systemId: T.sys_chw,  tag: "CHWP-02",  assetType: "Chilled-water pump (primary)",  vendor: "AquaFlow Systems" },
    { id: T.asset_chwp03, projectId: T.project, systemId: T.sys_chw,  tag: "CHWP-03",  assetType: "Chilled-water pump (standby)",  vendor: "AquaFlow Systems" },
    { id: T.asset_mcc01,  projectId: T.project, systemId: T.sys_elec, tag: "MCC-01",   assetType: "Motor control centre",           vendor: "Siemens" },
    { id: T.asset_ups01,  projectId: T.project, systemId: T.sys_elec, tag: "UPS-01",   assetType: "Uninterruptible power supply",   vendor: "Eaton" },
    { id: T.asset_fm200,  projectId: T.project, systemId: T.sys_fire, tag: "FM200-01", assetType: "FM-200 suppression module",      vendor: "Kidde" },
    { id: T.asset_ahu01,  projectId: T.project, systemId: T.sys_hvac, tag: "AHU-01",   assetType: "Air handling unit (Zone A)",     vendor: "Daikin" },
    { id: T.asset_ahu02,  projectId: T.project, systemId: T.sys_hvac, tag: "AHU-02",   assetType: "Air handling unit (Zone B)",     vendor: "Daikin" },
    { id: T.asset_crac01, projectId: T.project, systemId: T.sys_hvac, tag: "CRAC-01",  assetType: "Computer room AC unit",          vendor: "Vertiv" },
    { id: T.asset_gen01,  projectId: T.project, systemId: T.sys_elec, tag: "GEN-01",   assetType: "Diesel generator (standby)",     vendor: "Caterpillar" },
    { id: T.asset_pdu01,  projectId: T.project, systemId: T.sys_elec, tag: "PDU-01",   assetType: "Power distribution unit",        vendor: "Raritan" },
  ]).onConflictDoNothing();
  console.log("  ✓ Assets (10 items)");

  // ── Gates ─────────────────────────────────────────────────────────────────
  await db.insert(gates).values([
    { id: T.gate_l1, projectId: T.project, systemId: T.sys_chw,  sequenceNumber: "1", name: "L1 Factory Acceptance Test",          status: "approved",    approvalRole: "approver" },
    { id: T.gate_l2, projectId: T.project, systemId: T.sys_elec, sequenceNumber: "2", name: "L2 Mechanical Completion",            status: "approved",    approvalRole: "approver" },
    { id: T.gate_l3, projectId: T.project, systemId: T.sys_chw,  sequenceNumber: "3", name: "L3 Pre-Functional Check",             status: "in_review",   approvalRole: "approver" },
    { id: T.gate_l4, projectId: T.project, systemId: T.sys_chw,  sequenceNumber: "4", name: "L4 Functional Performance Testing",   status: "not_started", approvalRole: "approver" },
    { id: T.gate_l5, projectId: T.project, systemId: T.sys_fire, sequenceNumber: "5", name: "L5 Integrated Systems Testing (IST)", status: "blocked",     approvalRole: "approver" },
  ]).onConflictDoNothing();
  console.log("  ✓ Gates (L1-approved, L2-approved, L3-in_review, L4-not_started, L5-blocked)");

  // ── Documents & versions ──────────────────────────────────────────────────
  await db.insert(documents).values([
    { id: T.doc_chw_proc, projectId: T.project, documentType: "procedure", title: "CHW Plant Commissioning Procedure" },
    { id: T.doc_ashrae,   projectId: T.project, documentType: "standard",  title: "ASHRAE Std 90.1-2022 — Energy Standard",    standardSet: "ASHRAE" },
    { id: T.doc_nfpa,     projectId: T.project, documentType: "standard",  title: "NFPA 2001 — Clean Agent Fire Suppression",   standardSet: "NFPA" },
  ]).onConflictDoNothing();

  await db.insert(documentVersions).values([
    { id: T.ver_chw_prev, documentId: T.doc_chw_proc, revision: "Rev B",    status: "superseded",  sha256: sha256("chw-proc-rev-b"),    objectKey: "seed/chw-procedure-rev-b.pdf",     mediaType: "application/pdf", extractionStatus: "completed", createdAt: daysAgo(60) },
    { id: T.ver_chw_proc, documentId: T.doc_chw_proc, revision: "Rev C",    status: "approved",    sha256: sha256("chw-proc-rev-c"),    objectKey: "seed/chw-procedure-rev-c.pdf",     mediaType: "application/pdf", extractionStatus: "completed" },
    { id: T.ver_ashrae,   documentId: T.doc_ashrae,   revision: "Rev 2022", status: "approved",    sha256: sha256("ashrae-90.1-2022"),  objectKey: "seed/ashrae-90-1-2022.pdf",        mediaType: "application/pdf", extractionStatus: "completed" },
    { id: T.ver_nfpa,     documentId: T.doc_nfpa,     revision: "Rev 2018", status: "approved",    sha256: sha256("nfpa-2001-2018"),    objectKey: "seed/nfpa-2001-2018.pdf",          mediaType: "application/pdf", extractionStatus: "completed" },
  ]).onConflictDoNothing();
  console.log("  ✓ Documents & versions (procedure + 2 standards)");

  // ── Source regions ────────────────────────────────────────────────────────
  const regions = [
    {
      id: T.reg_r1, documentVersionId: T.ver_chw_proc, pageNumber: "14",
      bbox: [72, 162, 530, 240], contentHash: sha256("reg-r1"),
      extractedText: "Primary and standby chilled-water pumps shall maintain design flow of 450 LPM during the L4 integrated test. Flow deviation greater than ±5% shall constitute a test failure.",
    },
    {
      id: T.reg_r2, documentVersionId: T.ver_chw_proc, pageNumber: "21",
      bbox: [72, 300, 530, 380], contentHash: sha256("reg-r2"),
      extractedText: "Chilled water supply temperature at the header shall not exceed 7 °C at design load conditions.",
    },
    {
      id: T.reg_r3, documentVersionId: T.ver_ashrae, pageNumber: "37",
      bbox: [72, 450, 530, 530], contentHash: sha256("reg-r3"),
      extractedText: "Pump motor efficiency shall be ≥ 92% at full load as per ASHRAE Std 90.1-2022 Section 10.4.3.",
    },
    {
      id: T.reg_r4, documentVersionId: T.ver_ashrae, pageNumber: "52",
      bbox: [72, 100, 530, 190], contentHash: sha256("reg-r4"),
      extractedText: "Electrical panels and distribution boards serving mechanical equipment shall be rated for a minimum IP54 ingress protection class per IEC 60529.",
    },
    {
      id: T.reg_r5, documentVersionId: T.ver_nfpa, pageNumber: "8",
      bbox: [72, 200, 530, 290], contentHash: sha256("reg-r5"),
      extractedText: "FM-200 suppression systems shall achieve agent concentration not less than 7.0% v/v within 10 seconds of discharge. Agent weight shall be verified by an independent calibrated scale prior to commissioning.",
    },
    {
      id: T.reg_r6, documentVersionId: T.ver_chw_proc, pageNumber: "30",
      bbox: [72, 400, 530, 470], contentHash: sha256("reg-r6"),
      extractedText: "UPS transfer time to battery backup shall not exceed 8 milliseconds under full load. The switchover shall be tested with a live full-load block and recorded on a calibrated oscilloscope.",
    },
  ];
  await db.insert(sourceRegions).values([
    ...regions,
    {
      id: T.reg_prev_r1, documentVersionId: T.ver_chw_prev, pageNumber: "14",
      bbox: [72, 162, 530, 240], contentHash: sha256("reg-prev-r1"),
      extractedText: "Primary and standby chilled-water pumps shall maintain design flow of 430 LPM during the L4 integrated test. Flow deviation greater than ±5% shall constitute a test failure.",
    },
  ]).onConflictDoNothing();
  console.log("  ✓ Source regions (6 current + 1 superseded revision region)");

  // ── Requirements ──────────────────────────────────────────────────────────
  const reqNow = new Date();
  await db.insert(requirements).values([
    // Accepted requirements (reviewState = accepted)
    { id: T.req_r1, projectId: T.project, sourceRegionId: T.reg_r1, statement: "Primary and standby CHW pumps shall maintain design flow of 450 LPM during the L4 integrated test. Flow deviation > ±5% constitutes a test failure.", modality: "shall", reviewState: "accepted", numericValue: "450", unit: "LPM", tolerance: "22.5", reviewedBy: T.user_admin, reviewedAt: daysAgo(10), confidence: "0.9600" },
    { id: T.req_r2, projectId: T.project, sourceRegionId: T.reg_r2, statement: "CHW supply temperature at the header shall not exceed 7 °C at design load.", modality: "shall", reviewState: "accepted", numericValue: "7", unit: "°C", tolerance: "0.5", reviewedBy: T.user_admin, reviewedAt: daysAgo(10), confidence: "0.9400" },
    { id: T.req_r3, projectId: T.project, sourceRegionId: T.reg_r3, statement: "Pump motor efficiency shall be ≥ 92% at full load (ASHRAE 90.1-2022 §10.4.3).", modality: "shall", reviewState: "accepted", numericValue: "92", unit: "%", tolerance: "1", reviewedBy: T.user_admin, reviewedAt: daysAgo(9), confidence: "0.9100" },
    { id: T.req_r4, projectId: T.project, sourceRegionId: T.reg_r4, statement: "Electrical panels serving mechanical equipment shall be rated IP54 minimum (IEC 60529).", modality: "shall", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(8), confidence: "0.8800" },
    { id: T.req_r5, projectId: T.project, sourceRegionId: T.reg_r5, statement: "FM-200 agent concentration shall reach ≥ 7.0% v/v within 10 seconds of discharge.", modality: "shall", reviewState: "accepted", numericValue: "7", unit: "%v/v", tolerance: "0.1", reviewedBy: T.user_approver, reviewedAt: daysAgo(7), confidence: "0.9700" },
    { id: T.req_r6, projectId: T.project, sourceRegionId: T.reg_r6, statement: "UPS transfer time to battery backup shall not exceed 8 ms under full load.", modality: "shall", reviewState: "accepted", numericValue: "8", unit: "ms", tolerance: "0.5", reviewedBy: T.user_approver, reviewedAt: daysAgo(6), confidence: "0.9300" },
    // Proposed requirements (awaiting review — visible on dashboard)
    { id: T.req_r7, projectId: T.project, sourceRegionId: T.reg_r1, statement: "Flow test shall be witnessed by a third-party commissioning authority.", modality: "shall", reviewState: "proposed", confidence: "0.7200" },
    { id: T.req_r8, projectId: T.project, sourceRegionId: T.reg_r3, statement: "Pump vibration levels shall not exceed 2.8 mm/s RMS at design speed.", modality: "shall", reviewState: "proposed", numericValue: "2.8", unit: "mm/s", confidence: "0.8500" },
    // Edited requirement
    { id: T.req_r9, projectId: T.project, sourceRegionId: T.reg_r4, statement: "All distribution boards shall be rated IP55 (amended from IP54 per site survey).", modality: "shall", reviewState: "edited", reviewedBy: T.user_admin, reviewedAt: daysAgo(3), reviewNote: "Site survey found IP54 insufficient for outdoor-facing sections.", confidence: "0.8200" },
    // Rejected requirement
    { id: T.req_r10, projectId: T.project, sourceRegionId: T.reg_r6, statement: "UPS shall include a bypass maintenance switch rated at 1,000 A.", modality: "shall", reviewState: "rejected", reviewedBy: T.user_admin, reviewedAt: daysAgo(2), reviewNote: "Covered by separate electrical scope — not a commissioning requirement.", confidence: "0.6000" },
    // Retained against Rev B so /changes can trace Rev C's amendment through
    // requirement -> evidence/gate without mutating the current Rev C records.
    { id: T.req_prev_r1, projectId: T.project, sourceRegionId: T.reg_prev_r1, statement: "Rev B required primary and standby CHW pumps to maintain 430 LPM during the L4 integrated test.", modality: "shall", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(50), confidence: "0.9500" },
  ]).onConflictDoNothing();
  console.log("  ✓ Requirements (6 accepted, 2 proposed, 1 edited, 1 rejected)");

  // ── Evidence ──────────────────────────────────────────────────────────────
  await db.insert(evidence).values([
    { id: T.evid_e1, projectId: T.project, systemId: T.sys_chw, assetId: T.asset_chwp02, evidenceType: "inspection",   validityState: "accepted", contentHash: sha256("evid-e1"), notes: "Pump flow verified at 452 LPM — within ±5% tolerance. Witnessed by Aarav Mehta and third-party CxA.", capturedBy: T.user_field, capturedAt: daysAgo(5), clientCaptureId: "seed-cap-001" },
    { id: T.evid_e2, projectId: T.project, systemId: T.sys_chw, assetId: T.asset_chwp02, evidenceType: "measurement",  validityState: "accepted", contentHash: sha256("evid-e2"), notes: "CHW supply temp logged at 6.8 °C over 4-hour steady-state run. Trend data attached.", capturedBy: T.user_field, capturedAt: daysAgo(4), clientCaptureId: "seed-cap-002" },
    { id: T.evid_e3, projectId: T.project, systemId: T.sys_chw, assetId: T.asset_chwp03, evidenceType: "test_record",  validityState: "pending",  contentHash: sha256("evid-e3"), notes: "Standby pump CHWP-03 flow verification in progress. Pending lab calibration certificate.", capturedBy: T.user_field, capturedAt: daysAgo(1), clientCaptureId: "seed-cap-003" },
    { id: T.evid_e4, projectId: T.project, systemId: T.sys_elec, assetId: T.asset_ups01, evidenceType: "test_record",  validityState: "stale",    contentHash: sha256("evid-e4"), notes: "UPS transfer time tested at 7.2 ms — within tolerance. SOURCE REVISED: re-test required following UPS firmware upgrade.", capturedBy: T.user_field, capturedAt: daysAgo(20), clientCaptureId: "seed-cap-004" },
    { id: T.evid_e5, projectId: T.project, systemId: T.sys_fire, assetId: T.asset_fm200, evidenceType: "inspection",   validityState: "accepted", contentHash: sha256("evid-e5"), notes: "FM-200 agent weight verified by calibrated scale: 87.4 kg (design: 86 kg). Concentration calc confirms ≥7.0% v/v.", capturedBy: T.user_approver, capturedAt: daysAgo(3), clientCaptureId: "seed-cap-005" },
  ]).onConflictDoNothing();
  console.log("  ✓ Evidence (2 accepted, 1 pending, 1 stale, 1 accepted)");

  // ── Findings ──────────────────────────────────────────────────────────────
  await db.insert(findings).values([
    { id: T.find_f1, projectId: T.project, gateId: T.gate_l4, title: "CHWP-03 standby pump flow not yet verified", description: "Standby pump flow test incomplete — lab calibration cert outstanding from AquaFlow.", severity: "high",     status: "open",        ownerId: T.user_field,    dueAt: daysFromNow(5) },
    { id: T.find_f2, projectId: T.project, gateId: T.gate_l5, title: "FM-200 suppression system discharge test blocked by operations", description: "Live discharge test requires 48 h data-centre downtime window. Ops team approval pending.", severity: "critical",  status: "in_progress", ownerId: T.user_approver, dueAt: daysFromNow(10) },
    { id: T.find_f3, projectId: T.project, gateId: T.gate_l3, title: "UPS firmware upgrade invalidates prior transfer-time evidence", description: "UPS-01 firmware upgraded to v4.2.1. All prior transfer-time measurements are stale and must be re-taken.", severity: "medium",   status: "open",        ownerId: T.user_field,    dueAt: daysFromNow(3) },
    { id: T.find_f4, projectId: T.project, gateId: T.gate_l2, title: "MCC-01 witness signature sheet incomplete", description: "Factory acceptance test witness sheet missing signatures from two panel witnesses. Scan to be provided by Siemens.", severity: "low",      status: "closed",      ownerId: T.user_admin, resolutionNote: "Signed sheets received from Siemens and scanned into DMS on 2025-07-10.", resolvedAt: daysAgo(8), resolvedBy: T.user_admin },
  ]).onConflictDoNothing();
  console.log("  ✓ Findings (high open, critical in-progress, medium open, low closed)");

  // ── Graph edges ───────────────────────────────────────────────────────────
  await db.insert(edges).values([
    // Requirements AFFECTS gates
    { id: T.edge_req1_gate4,  projectId: T.project, fromType: "requirement", fromId: T.req_r1, relationshipType: "AFFECTS",   toType: "gate",        toId: T.gate_l4 },
    { id: T.edge_req2_gate3,  projectId: T.project, fromType: "requirement", fromId: T.req_r2, relationshipType: "AFFECTS",   toType: "gate",        toId: T.gate_l3 },
    { id: T.edge_req3_gate4,  projectId: T.project, fromType: "requirement", fromId: T.req_r3, relationshipType: "AFFECTS",   toType: "gate",        toId: T.gate_l4 },
    { id: T.edge_req4_gate2,  projectId: T.project, fromType: "requirement", fromId: T.req_r4, relationshipType: "AFFECTS",   toType: "gate",        toId: T.gate_l2 },
    { id: T.edge_req5_gate5,  projectId: T.project, fromType: "requirement", fromId: T.req_r5, relationshipType: "AFFECTS",   toType: "gate",        toId: T.gate_l5 },
    { id: T.edge_req6_gate3,  projectId: T.project, fromType: "requirement", fromId: T.req_r6, relationshipType: "AFFECTS",   toType: "gate",        toId: T.gate_l3 },
    // Evidence PROVES requirements
    { id: T.edge_evid1_req1,  projectId: T.project, fromType: "evidence",    fromId: T.evid_e1, relationshipType: "PROVES",   toType: "requirement", toId: T.req_r1 },
    { id: T.edge_evid2_req2,  projectId: T.project, fromType: "evidence",    fromId: T.evid_e2, relationshipType: "PROVES",   toType: "requirement", toId: T.req_r2 },
    { id: T.edge_evid5_req5,  projectId: T.project, fromType: "evidence",    fromId: T.evid_e5, relationshipType: "PROVES",   toType: "requirement", toId: T.req_r5 },
    // Gate prerequisites
    { id: T.edge_gate1_gate2, projectId: T.project, fromType: "gate",        fromId: T.gate_l1, relationshipType: "PRECEDES", toType: "gate",        toId: T.gate_l2 },
    { id: T.edge_gate2_gate3, projectId: T.project, fromType: "gate",        fromId: T.gate_l2, relationshipType: "PRECEDES", toType: "gate",        toId: T.gate_l3 },
    { id: T.edge_gate3_gate4, projectId: T.project, fromType: "gate",        fromId: T.gate_l3, relationshipType: "PRECEDES", toType: "gate",        toId: T.gate_l4 },
    { id: T.edge_prev_req_gate4, projectId: T.project, fromType: "requirement", fromId: T.req_prev_r1, relationshipType: "AFFECTS", toType: "gate", toId: T.gate_l4 },
    { id: T.edge_evid1_prev_req, projectId: T.project, fromType: "evidence", fromId: T.evid_e1, relationshipType: "PROVES", toType: "requirement", toId: T.req_prev_r1 },
  ]).onConflictDoNothing();
  console.log("  ✓ Graph edges (requirements→gates AFFECTS, evidence→requirements PROVES, gate prerequisites)");

  // ── Cx Checklist ──────────────────────────────────────────────────────────
  await db.insert(cxChecklists).values({
    id: T.cx_checklist,
    tenantId: T.tenant,
    projectId: T.project,
    systemId: T.sys_chw,
    gateId: T.gate_l4,
    assetId: T.asset_chwp02,
    title: "CHWP-02 L4 Integrated Flow Test Checklist",
    status: "accepted",
    standardVersionIds: [T.ver_chw_proc, T.ver_ashrae],
    generationStatus: "completed",
    generationModelVersion: "mock-v1",
    createdBy: T.user_admin,
    reviewedBy: T.user_approver,
    reviewedAt: daysAgo(3),
    reviewNote: "Checklist reviewed and accepted. Proceed with test execution.",
  }).onConflictDoNothing();

  await db.insert(cxChecklistSteps).values([
    { id: T.cx_step1, checklistId: T.cx_checklist, sequenceNumber: "1", instruction: "Verify isolation valves on suction and discharge sides of CHWP-02 are fully open. Record valve positions.", modality: "boolean", expectedBoolean: true, required: true, reviewState: "accepted" },
    { id: T.cx_step2, checklistId: T.cx_checklist, sequenceNumber: "2", instruction: "Start CHWP-02 and allow 5 minutes steady state. Record flow meter reading in LPM.", modality: "numeric", parameter: "Measured flow rate", nominalValue: "450", unit: "LPM", tolerance: "22.5", required: true, reviewState: "accepted" },
    { id: T.cx_step3, checklistId: T.cx_checklist, sequenceNumber: "3", instruction: "Measure CHW supply temperature at the header using a calibrated thermocouple. Record value in °C.", modality: "numeric", parameter: "CHW supply temp", nominalValue: "7", unit: "°C", tolerance: "0.5", required: true, reviewState: "accepted" },
    { id: T.cx_step4, checklistId: T.cx_checklist, sequenceNumber: "4", instruction: "Record any abnormal noise, vibration, or leakage. Note observations for the commissioning authority.", modality: "narrative", narrativeCriterion: "No abnormal noise, vibration or leakage observed during steady-state run.", required: false, reviewState: "accepted" },
  ]).onConflictDoNothing();

  await db.insert(cxClauseCitations).values([
    { id: T.cx_citation1, checklistId: T.cx_checklist, stepId: T.cx_step2, clauseReference: "CHW-PROC Rev C §7.3.1 — Flow verification method", sourceRegionId: T.reg_r1, verificationStatus: "verified", verificationReason: "Region confirmed: exact flow tolerance clause." },
    { id: T.cx_citation2, checklistId: T.cx_checklist, stepId: T.cx_step3, clauseReference: "CHW-PROC Rev C §7.3.2 — Temperature set-point", sourceRegionId: T.reg_r2, verificationStatus: "verified", verificationReason: "Region confirmed: 7 °C supply temperature requirement." },
  ]).onConflictDoNothing();
  console.log("  ✓ Cx checklist (accepted) with 4 steps and 2 citations");

  // ── Cx Test Record (partially executed) ───────────────────────────────────
  await db.insert(cxTestRecords).values({
    id: T.cx_record,
    tenantId: T.tenant,
    projectId: T.project,
    checklistId: T.cx_checklist,
    gateId: T.gate_l4,
    executedBy: T.user_field,
    overallStatus: "needs_human_review",
    reportStatus: "draft",
    reportGenerationStatus: "not_started",
  }).onConflictDoNothing();

  // Step results: step1 pass (bool), step2 pass (numeric), step3 fail (numeric out of tolerance)
  await db.insert(cxStepResults).values([
    { id: T.cx_result1, testRecordId: T.cx_record, stepId: T.cx_step1, readingBoolean: true,  enteredBy: T.user_field, enteredAt: daysAgo(1), verdict: "proposed_pass" },
    { id: T.cx_result2, testRecordId: T.cx_record, stepId: T.cx_step2, readingValue: "451.3", enteredBy: T.user_field, enteredAt: daysAgo(1), verdict: "proposed_pass" },
    { id: T.cx_result3, testRecordId: T.cx_record, stepId: T.cx_step3, readingValue: "7.8",   enteredBy: T.user_field, enteredAt: daysAgo(1), verdict: "proposed_fail", findingId: T.find_f1 },
  ]).onConflictDoNothing();
  console.log("  ✓ Cx test record (in-progress: 2 pass, 1 fail on temp)");

  // ── Compliance checks ─────────────────────────────────────────────────────
  await db.insert(complianceChecks).values([
    {
      id: T.comp_c1,
      projectId: T.project,
      requirementId: T.req_r1,
      targetSourceRegionId: T.reg_r2,
      comparisonType: "numeric",
      requirementSnapshot: { statement: "CHW pumps shall maintain 450 LPM", numericValue: "450", unit: "LPM", tolerance: "22.5" },
      targetSnapshot:      { text: "Flow rate: 1.2 bar minimum at header", rawUnit: "bar" },
      verdict: "deviation",
      reviewState: "proposed",
      confidence: "0.8700",
      reason: "Target uses bar pressure, not LPM flow — units are not directly comparable. Engineer review required to determine equivalence.",
      findingDisposition: "not_applicable",
      version: 1,
    },
    {
      id: T.comp_c2,
      projectId: T.project,
      requirementId: T.req_r4,
      targetSourceRegionId: T.reg_r4,
      comparisonType: "qualitative",
      requirementSnapshot: { statement: "Electrical panels shall be rated IP54 (IEC 60529)" },
      targetSnapshot:      { text: "All panels in scope of this contract shall achieve ingress protection suitable for indoor industrial environments." },
      verdict: "needs_engineering_judgment",
      reviewState: "proposed",
      confidence: "0.6200",
      reason: "Target clause does not specify an IP rating numerically. Qualitative equivalence cannot be determined without engineer review.",
      findingDisposition: "not_applicable",
      version: 1,
    },
  ]).onConflictDoNothing();
  console.log("  ✓ Compliance checks (1 numeric deviation, 1 qualitative — both proposed)");

  // ── Schedule resources ────────────────────────────────────────────────────
  await db.insert(scheduleResources).values([
    { id: T.sched_res1, projectId: T.project, name: "Commissioning Team Alpha", capacity: 5, unit: "crew", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(15), confidence: "0.9500" },
    { id: T.sched_res2, projectId: T.project, name: "Thermal Imaging Camera",   capacity: 1, unit: "unit", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(15), confidence: "0.9500" },
  ]).onConflictDoNothing();
  console.log("  ✓ Schedule resources (crew + camera)");

  // ── Schedule tasks ────────────────────────────────────────────────────────
  const taskEarliestStart = new Date("2025-08-01T00:00:00Z");
  await db.insert(scheduleTasks).values([
    { id: T.sched_task1, projectId: T.project, name: "CHWP-02 Mechanical Installation & Alignment",  durationHours: 48, earliestStart: new Date("2025-08-01T00:00:00Z"), vendor: "AquaFlow Systems",    confidence: "0.9000", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(12) },
    { id: T.sched_task2, projectId: T.project, name: "CHWP-02 Pre-Functional Inspection",           durationHours: 24, earliestStart: new Date("2025-08-04T00:00:00Z"), vendor: "CxA Consultants",     confidence: "0.9200", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(12) },
    { id: T.sched_task3, projectId: T.project, name: "L3 Pre-Functional Check Execution",           durationHours: 16, earliestStart: new Date("2025-08-06T00:00:00Z"), vendor: "CxA Consultants",     confidence: "0.8800", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(11) },
    { id: T.sched_task4, projectId: T.project, name: "L4 Integrated Systems Test Execution",        durationHours: 48, earliestStart: new Date("2025-08-08T00:00:00Z"), deadline: new Date("2025-08-20T00:00:00Z"), deadlineType: "hard", vendor: "CxA Consultants", confidence: "0.8500", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(11) },
    { id: T.sched_task5, projectId: T.project, name: "Turnover Documentation & Handover",           durationHours: 8,  earliestStart: new Date("2025-08-15T00:00:00Z"), vendor: "Pramana PMO",         confidence: "0.9500", reviewState: "accepted", reviewedBy: T.user_admin, reviewedAt: daysAgo(10) },
  ]).onConflictDoNothing();

  // Task-resource assignments (demand)
  await db.insert(scheduleTaskResources).values([
    { taskId: T.sched_task1, resourceId: T.sched_res1, demand: 3 },
    { taskId: T.sched_task2, resourceId: T.sched_res1, demand: 2 },
    { taskId: T.sched_task2, resourceId: T.sched_res2, demand: 1 },
    { taskId: T.sched_task3, resourceId: T.sched_res1, demand: 2 },
    { taskId: T.sched_task4, resourceId: T.sched_res1, demand: 4 },
    { taskId: T.sched_task5, resourceId: T.sched_res1, demand: 1 },
  ]).onConflictDoNothing();

  // Dependencies
  await db.insert(scheduleDependencies).values([
    { id: T.sched_dep1, projectId: T.project, predecessorTaskId: T.sched_task1, successorTaskId: T.sched_task2 },
    { id: T.sched_dep2, projectId: T.project, predecessorTaskId: T.sched_task2, successorTaskId: T.sched_task3 },
    { id: T.sched_dep3, projectId: T.project, predecessorTaskId: T.sched_task3, successorTaskId: T.sched_task4 },
  ]).onConflictDoNothing();
  console.log("  ✓ Schedule tasks (5 accepted), resources, dependencies");

  // ── Schedule version (v1 — solved baseline) ───────────────────────────────
  await db.insert(scheduleVersions).values({
    id: T.sched_ver1,
    projectId: T.project,
    versionNumber: 1,
    reason: "Initial CP-SAT solve — baseline schedule for L4 commissioning campaign",
    solverStatus: "optimal",
    solverVersion: "ortools-cp-sat-v1",
    inputHash: sha256("schedule-input-v1"),
    objectiveHours: 144,
    criticalTaskIds: [T.sched_task1, T.sched_task4],
    bottlenecks: [{ resourceId: T.sched_res1, taskId: T.sched_task4, reason: "Max crew capacity reached during L4 test" }],
    overrunHours: 0,
    explanation: "Optimal schedule found. Critical path runs through CHWP-02 installation → L4 integrated test. Commissioning Team Alpha is the binding constraint during the integrated test window. Task 3 (L3 pre-functional) has 2-day float before the deadline.",
    explanationModelVersion: "mock-v1",
    explanationGeneratedAt: daysAgo(10),
    createdBy: T.user_admin,
  }).onConflictDoNothing();

  // Assignments (real CP-SAT-like dates)
  await db.insert(scheduleAssignments).values([
    { id: T.sched_asgn1, versionId: T.sched_ver1, taskId: T.sched_task1, startAt: new Date("2025-08-01T06:00:00Z"), endAt: new Date("2025-08-03T06:00:00Z"), isCritical: true },
    { id: T.sched_asgn2, versionId: T.sched_ver1, taskId: T.sched_task2, startAt: new Date("2025-08-04T06:00:00Z"), endAt: new Date("2025-08-05T06:00:00Z"), isCritical: false },
    { id: T.sched_asgn3, versionId: T.sched_ver1, taskId: T.sched_task3, startAt: new Date("2025-08-06T06:00:00Z"), endAt: new Date("2025-08-07T06:00:00Z"), isCritical: false },
    { id: T.sched_asgn4, versionId: T.sched_ver1, taskId: T.sched_task4, startAt: new Date("2025-08-08T06:00:00Z"), endAt: new Date("2025-08-10T06:00:00Z"), isCritical: true },
    { id: T.sched_asgn5, versionId: T.sched_ver1, taskId: T.sched_task5, startAt: new Date("2025-08-11T06:00:00Z"), endAt: new Date("2025-08-11T14:00:00Z"), isCritical: false },
  ]).onConflictDoNothing();
  console.log("  ✓ Schedule version v1 (optimal) with 5 assignments");

  // ── Risk signal + schedule risk ───────────────────────────────────────────
  const pollCycleId = "10000000-0000-4000-8000-0000000000FF";
  await db.insert(riskSignals).values({
    id: T.risk_sig1,
    projectId: T.project,
    taskId: T.sched_task4,
    pollCycleId,
    signalType: "procurement",
    status: "material",
    dataAvailable: true,
    source: "synthetic-procurement-client",
    value: { delay_days: 5, item: "CHWP-02 impeller replacement kit", supplier: "AquaFlow Systems", reason: "Port congestion at JNPT Mumbai" },
    observedAt: daysAgo(2),
  }).onConflictDoNothing();

  await db.insert(scheduleRisks).values({
    id: T.risk_rec1,
    projectId: T.project,
    taskId: T.sched_task4,
    sourceSignalId: T.risk_sig1,
    riskType: "procurement_delay",
    status: "active",
    probability: "0.7200",
    estimatedDelayHours: 120,
    mitigationOptions: [
      { option: "Expedite air freight for impeller kit from AquaFlow warehouse", cost: "high" },
      { option: "Defer L4 test by 5 days and use buffer window", cost: "low" },
    ],
    materialityHash: sha256("risk-materiality-v1"),
    reviewState: "proposed",
    version: 1,
    observedAt: daysAgo(2),
  }).onConflictDoNothing();
  console.log("  ✓ Risk signal + schedule risk (procurement delay, 72% probability)");

  // ── Shipments ─────────────────────────────────────────────────────────────
  await db.insert(shipments).values([
    {
      id: T.ship_s1,
      tenantId: T.tenant,
      projectId: T.project,
      equipmentId: T.asset_chwp02,
      name: "CHWP-02 Primary Pump — AquaFlow Shipment",
      originName: "Shanghai, China",
      originLat: "31.230416",
      originLng: "121.473701",
      destinationName: "JNPT Mumbai, India",
      destinationLat: "18.949200",
      destinationLng: "72.934700",
      currentLat: "14.500000",
      currentLng: "89.000000",
      positionSource: "simulated",
      mmsi: "413123456",
      plannedEta: daysFromNow(8),
      requiredOnSite: daysFromNow(12),
      portCongestion: false,
      status: "green",
      createdBy: T.user_admin,
    },
    {
      id: T.ship_s2,
      tenantId: T.tenant,
      projectId: T.project,
      equipmentId: T.asset_chwp03,
      name: "CHWP-03 Standby Pump — Delayed Shipment",
      originName: "Rotterdam, Netherlands",
      originLat: "51.922900",
      originLng: "4.462200",
      destinationName: "JNPT Mumbai, India",
      destinationLat: "18.949200",
      destinationLng: "72.934700",
      currentLat: "25.000000",
      currentLng: "57.000000",
      positionSource: "simulated",
      mmsi: "246789012",
      plannedEta: daysAgo(2),              // Already past ETA → delayed
      weatherAdjustedEta: daysFromNow(3),  // Adjusted forward
      weatherDelayFactor: "0.15000",
      telemetryReason: "Vessel diverted to Khor Fakkan anchorage due to port congestion at JNPT. ETA revised.",
      requiredOnSite: daysFromNow(5),
      portCongestion: true,
      status: "amber",
      createdBy: T.user_admin,
    },
  ]).onConflictDoNothing();
  console.log("  ✓ Shipments (1 green on-track, 1 amber delayed)");

  // ── Alerts ────────────────────────────────────────────────────────────────
  await db.insert(alerts).values([
    {
      id: T.alert_a1,
      projectId: T.project,
      eventType: "SHIPMENT_DELAYED",
      dedupKey: `SHIPMENT_DELAYED:${T.ship_s2}`,
      status: "active",
      title: "CHWP-03 Standby Pump shipment delayed — 3 days past planned ETA",
      payload: { shipmentId: T.ship_s2, shipmentName: "CHWP-03 Standby Pump — Delayed Shipment", delayDays: 3, requiredOnSite: daysFromNow(5).toISOString() },
    },
    {
      id: T.alert_a2,
      projectId: T.project,
      eventType: "predicted_risk_delay",
      dedupKey: `predicted_risk:${T.sched_task4}:procurement_delay`,
      status: "active",
      title: "Procurement risk: CHWP-02 impeller kit — 5-day delay risk for L4 Test",
      payload: { taskId: T.sched_task4, taskName: "L4 Integrated Systems Test Execution", riskId: T.risk_rec1, probability: 0.72, estimatedDelayHours: 120 },
    },
  ]).onConflictDoNothing();
  console.log("  ✓ Alerts (SHIPMENT_DELAYED + predicted_risk_delay — both active)");

  // ── Knowledge chunks ──────────────────────────────────────────────────────
  await db.insert(knowledgeChunks).values([
    { id: T.kc_1, tenantId: T.tenant, projectId: T.project, sourceRegionId: T.reg_r1, documentType: "procedure", content: regions[0]!.extractedText, contentHash: sha256("kc-1") },
    { id: T.kc_3, tenantId: T.tenant, projectId: T.project, sourceRegionId: T.reg_r3, documentType: "standard",  content: regions[2]!.extractedText, contentHash: sha256("kc-3") },
    { id: T.kc_5, tenantId: T.tenant, projectId: T.project, sourceRegionId: T.reg_r5, documentType: "standard",  content: regions[4]!.extractedText, contentHash: sha256("kc-5") },
  ]).onConflictDoNothing();
  console.log("  ✓ Knowledge chunks (3 — for full-text search in /knowledge)");

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
✅  Seed complete — Mumbai DC-07 is ready.

  Users (password: Pramana@123!)
    admin@pramana.local     → Admin
    field@pramana.local     → Field Engineer
    approver@pramana.local  → Approver
    testbeta@ipdkimkc.com    → Clerk viewer
    atharva.v.deo@gmail.com  → Clerk admin

  Project: Mumbai DC-07 (MDC-07)
  Surfaces pre-populated:
    /            → Dashboard with metrics + proposal
    /sources     → 3 documents (procedure + 2 standards), all processed
    /requirements→ 10 requirements across all review states
    /evidence    → 5 records (accepted, pending, stale)
    /systems     → 4 systems, 10 assets, 5 gates (mixed statuses)
    /readiness   → L3 in_review, L4 not_started, L5 blocked
    /cx          → Accepted checklist, test record in progress
    /compliance  → 2 checks (numeric + qualitative) awaiting review
    /schedule    → 5 accepted tasks, dependencies, solved v1 with assignments
    /shipments   → Green shipment + delayed amber shipment on map
    /command-center → 2 active alerts (delayed ship + procurement risk)
    /knowledge   → 3 indexed chunks (try: "chilled water flow requirements")
    /actions     → 3 open findings (high, critical, medium)
    /graph       → All edges visible (AFFECTS, PROVES, PRECEDES)
`);
  process.exit(0);
}

seed().catch((error) => { console.error(error); process.exit(1); });

import { db } from "../src/lib/db/client";
import { eq } from "drizzle-orm";
import { assets, documentVersions, documents, edges, evidence, findings, gates, projectMembers, projects, requirements, sourceRegions, systems, tenants, users } from "../src/lib/db/schema";

const ids = {
  tenant: "10000000-0000-4000-8000-000000000001",
  user: "10000000-0000-4000-8000-000000000002",
  project: "10000000-0000-4000-8000-000000000003",
  system: "10000000-0000-4000-8000-000000000004",
  asset: "10000000-0000-4000-8000-000000000005",
  gate: "10000000-0000-4000-8000-000000000006",
  document: "10000000-0000-4000-8000-000000000007",
  version: "10000000-0000-4000-8000-000000000008",
  region: "10000000-0000-4000-8000-000000000009",
  requirement: "10000000-0000-4000-8000-000000000010",
  evidence: "10000000-0000-4000-8000-000000000011",
  finding: "10000000-0000-4000-8000-000000000012"
};

const isolationIds = { tenant: "20000000-0000-4000-8000-000000000001", project: "20000000-0000-4000-8000-000000000002" };

async function seed() {
  await db.insert(tenants).values({ id: ids.tenant, name: "Pramana Demo" }).onConflictDoNothing();
  await db.insert(tenants).values({ id: isolationIds.tenant, name: "Isolated Demo Tenant" }).onConflictDoNothing();
  await db.insert(users).values({ id: ids.user, email: "manager@pramana.local", displayName: "Aarav Mehta" }).onConflictDoNothing();
  await db.insert(projects).values({ id: ids.project, tenantId: ids.tenant, name: "Mumbai DC-07", code: "MDC-07", timezone: "Asia/Kolkata" }).onConflictDoNothing();
  await db.insert(projects).values({ id: isolationIds.project, tenantId: isolationIds.tenant, name: "Isolated DC-01", code: "IDC-01", timezone: "Asia/Kolkata" }).onConflictDoNothing();
  await db.insert(projectMembers).values({ projectId: ids.project, userId: ids.user, role: "commissioning_manager" }).onConflictDoNothing();
  await db.insert(systems).values({ id: ids.system, projectId: ids.project, name: "Chilled Water", systemType: "cooling" }).onConflictDoNothing();
  await db.insert(assets).values({ id: ids.asset, projectId: ids.project, systemId: ids.system, tag: "CHWP-02", assetType: "Chilled-water pump", vendor: "AquaFlow" }).onConflictDoNothing();
  await db.insert(gates).values({ id: ids.gate, projectId: ids.project, systemId: ids.system, name: "L4 Integrated Systems Test", sequenceNumber: "4", status: "in_review" }).onConflictDoNothing();
  await db.insert(documents).values({ id: ids.document, projectId: ids.project, documentType: "procedure", title: "CHW Plant Commissioning Procedure" }).onConflictDoNothing();
  await db.insert(documentVersions).values({ id: ids.version, documentId: ids.document, revision: "Rev C", status: "approved", sha256: "a".repeat(64), objectKey: "seed/chw-procedure.pdf", mediaType: "application/pdf", extractionStatus: "completed" }).onConflictDoNothing();
  await db.update(documentVersions).set({ extractionStatus: "completed" }).where(eq(documentVersions.id, ids.version));
  await db.insert(sourceRegions).values({ id: ids.region, documentVersionId: ids.version, pageNumber: "14", bbox: [72, 162, 530, 240], extractedText: "Primary and standby chilled-water pumps shall maintain design flow during the L4 integrated test.", contentHash: "b".repeat(64) }).onConflictDoNothing();
  await db.insert(requirements).values({ id: ids.requirement, projectId: ids.project, sourceRegionId: ids.region, statement: "Primary and standby chilled-water pumps shall maintain design flow during the L4 integrated test.", modality: "shall", reviewState: "proposed", confidence: "0.9400" }).onConflictDoNothing();
  await db.insert(evidence).values({ id: ids.evidence, projectId: ids.project, systemId: ids.system, assetId: ids.asset, evidenceType: "inspection", validityState: "accepted", capturedAt: new Date(), contentHash: "c".repeat(64) }).onConflictDoNothing();
  await db.insert(findings).values({ id: ids.finding, projectId: ids.project, gateId: ids.gate, title: "Witness signature for CHWP-02 flow test", severity: "high", status: "open", ownerId: ids.user }).onConflictDoNothing();
  await db.insert(edges).values([
    { projectId: ids.project, fromType: "requirement", fromId: ids.requirement, relationshipType: "AFFECTS", toType: "gate", toId: ids.gate },
    { projectId: ids.project, fromType: "evidence", fromId: ids.evidence, relationshipType: "PROVES", toType: "requirement", toId: ids.requirement }
  ]).onConflictDoNothing();
  console.log(`Seeded ${ids.project}`);
}

seed().catch((error) => { console.error(error); process.exit(1); });

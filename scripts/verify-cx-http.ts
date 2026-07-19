import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { assets, cxChecklistSteps, cxChecklists, cxClauseCitations, cxStepResults, cxTestRecords, documentVersions, documents, durableJobs, edges, evidence, gates, sourceRegions, storageObjects, systems } from "../src/lib/db/schema";
import { developmentProjectId } from "../src/lib/demo";
import { objectStorage } from "../src/lib/storage/service";

function pdfWithPages(texts: string[]) {
  const objects = new Map<number, string>();
  const pageIds = texts.map((_, index) => 3 + index * 2);
  const fontId = 3 + texts.length * 2;
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${texts.length} >>`);
  texts.forEach((text, index) => {
    const pageId = pageIds[index]; const contentId = pageId + 1; const escaped = text.replace(/([\\()])/g, "\\$1"); const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  for (let id = 1; id <= fontId; id += 1) { offsets[id] = Buffer.byteLength(pdf); pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${fontId + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function request(url: string, init?: RequestInit) { const response = await fetch(url, init); const body = await response.json(); if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${url} returned ${response.status}: ${JSON.stringify(body)}`); return body; }
async function poll(base: string, jobId: string) { for (let attempt = 0; attempt < 120; attempt += 1) { const body = await request(`${base}/api/jobs/${jobId}`); if (body.job.status === "completed") return body.job; if (body.job.status === "failed") throw new Error(`Job ${jobId} failed: ${body.job.error}`); await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`Job ${jobId} timed out.`); }

async function main() {
  const base = process.env.CX_TEST_URL ?? "http://localhost:4173"; const jobIds: string[] = []; const objectKeys: string[] = []; let documentId: string | undefined; let versionId: string | undefined; let checklistId: string | undefined; let recordId: string | undefined; let evidenceId: string | undefined; let artifactObjectId: string | undefined; let gateId: string | undefined; let originalGateStatus: string | undefined;
  try {
    const [system, gate, asset] = await Promise.all([db.query.systems.findFirst({ where: eq(systems.projectId, developmentProjectId) }), db.query.gates.findFirst({ where: eq(gates.projectId, developmentProjectId) }), db.query.assets.findFirst({ where: eq(assets.projectId, developmentProjectId) })]); assert.ok(system && gate && asset); gateId = gate.id; originalGateStatus = gate.status;
    const pdf = pdfWithPages(["Clause 1.1 Design flow shall be 100 L/s + 5.", "Clause 1.2 Verify standby interlock is present.", "Clause 1.3 Record vibration, leakage, and operational observations."]);
    const form = new FormData(); form.set("standardSet", `Cx verification ${Date.now()}`); form.set("title", "Synthetic controlled IST standard"); form.set("documentType", "standard"); form.set("revision", "Test Rev 1"); form.set("file", new Blob([pdf], { type: "application/pdf" }), "cx-verification.pdf");
    const standard = await request(`${base}/api/projects/${developmentProjectId}/cx/standards`, { method: "POST", body: form }); documentId = standard.document.id; versionId = standard.version.id; objectKeys.push(standard.version.objectKey); if (standard.extractionStatus === "processing") { jobIds.push(standard.ingestJobId); await poll(base, standard.ingestJobId); }
    const standards = await request(`${base}/api/projects/${developmentProjectId}/cx/standards`); const controlled = standards.items.find((item: { version: { id: string } }) => item.version.id === versionId); assert.equal(controlled.usableForGeneration, true); assert.equal(controlled.regionCount, 3);
    const checklist = await request(`${base}/api/projects/${developmentProjectId}/cx/checklists`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ systemId: system.id, gateId: gate.id, assetId: asset.id, title: "Cx governed workflow verification", standardVersionIds: [versionId] }) }); checklistId = checklist.checklist.id; jobIds.push(checklist.checklistJobId); if (checklist.status === "queued") await poll(base, checklist.checklistJobId);
    const detail = await request(`${base}/api/cx/checklists/${checklistId}`); assert.equal(detail.checklist.generationStatus, "completed"); assert.equal(detail.steps.length, 3); assert.equal(detail.citations.length, 3); assert.ok(detail.citations.every((citation: { verificationStatus: string; source: unknown }) => citation.verificationStatus === "verified" && citation.source));
    await request(`${base}/api/cx/checklists/${checklistId}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", note: "Accepted by governed Cx HTTP verification.", steps: [] }) });
    for (const step of detail.steps as Array<{ id: string; modality: string; nominalValue: string | null; expectedBoolean: boolean | null }>) {
      const payload = step.modality === "numeric" ? { value: Number(step.nominalValue) } : step.modality === "boolean" ? { boolean: step.expectedBoolean } : { text: "Engineer observed no abnormal vibration, leakage, or unsafe condition." };
      const reading = await request(`${base}/api/cx/checklists/${checklistId}/steps/${step.id}/reading`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); recordId = reading.testRecordId;
    }
    assert.ok(recordId); const recordBeforeReport = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, recordId) }); assert.equal(recordBeforeReport?.overallStatus, "needs_human_review");
    const draft = await request(`${base}/api/cx/test-records/${recordId}/report`, { method: "POST" }); jobIds.push(draft.reportJobId); if (draft.status === "queued") await poll(base, draft.reportJobId);
    const report = await request(`${base}/api/cx/reports/${recordId}`); assert.equal(report.label, "DRAFT — PENDING ENGINEER REVIEW"); assert.equal(report.report.reportGenerationStatus, "completed"); assert.equal(report.report.reportContent.steps.length, 3);
    const edited = await request(`${base}/api/cx/reports/${recordId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Engineer-reviewed Cx verification report", executiveSummary: "Engineer reviewed all immutable readings and the narrative observation against their exact controlled citations.", conclusion: "The recorded test is suitable for engineer approval into controlled evidence.", reason: "Corrected the generated narrative to record explicit engineer review." }) }); assert.equal(edited.report.reportContent.title, "Engineer-reviewed Cx verification report");
    const approved = await request(`${base}/api/cx/test-records/${recordId}/report/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Engineer reviewed the narrative criterion and all deterministic readings against controlled clauses." }) }); evidenceId = approved.evidenceId; const approvedRecord = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, recordId) }); artifactObjectId = approvedRecord?.reportArtifactObjectId ?? undefined; assert.equal(approved.gateState, "in_review"); assert.ok(approved.artifactHash); assert.equal(approvedRecord?.reportStatus, "approved"); assert.equal(approvedRecord?.reportContentHash, approved.artifactHash);
    const artifactResponse = await fetch(approved.artifactUrl.replace("http://minio:9000", "http://localhost:9000"));
    if (!artifactResponse.ok) {
      console.error("Artifact fetch failed!", artifactResponse.status, await artifactResponse.text());
    }
    assert.equal(artifactResponse.ok, true); const artifactBytes = Buffer.from(await artifactResponse.arrayBuffer()); assert.equal(createHash("sha256").update(artifactBytes).digest("hex"), approved.artifactHash); const artifact = JSON.parse(artifactBytes.toString()); assert.equal(artifact.label, "ENGINEER APPROVED — IMMUTABLE ARTIFACT"); assert.ok(artifact.approval.reason);
    const proofEdges = await db.select().from(edges).where(and(eq(edges.fromType, "evidence"), eq(edges.fromId, evidenceId))); assert.ok(proofEdges.some((edge) => edge.relationshipType === "AFFECTS" && edge.toType === "gate"));
    console.log("Cx HTTP verification passed: controlled standard extraction, cited async checklist, engineer acceptance, resumable proposed readings, editable draft, human narrative resolution, immutable artifact, evidence graph linkage, and gate in-review transition.");
  } finally {
    if (evidenceId) await db.delete(edges).where(and(eq(edges.fromType, "evidence"), eq(edges.fromId, evidenceId)));
    if (recordId) await db.delete(cxStepResults).where(eq(cxStepResults.testRecordId, recordId));
    if (recordId) await db.delete(cxTestRecords).where(eq(cxTestRecords.id, recordId));
    if (evidenceId) await db.delete(evidence).where(eq(evidence.id, evidenceId));
    if (checklistId) await db.delete(cxClauseCitations).where(eq(cxClauseCitations.checklistId, checklistId));
    if (checklistId) await db.delete(cxChecklistSteps).where(eq(cxChecklistSteps.checklistId, checklistId));
    if (checklistId) await db.delete(cxChecklists).where(eq(cxChecklists.id, checklistId));
    if (versionId) await db.delete(sourceRegions).where(eq(sourceRegions.documentVersionId, versionId));
    if (versionId) await db.delete(documentVersions).where(eq(documentVersions.id, versionId));
    if (documentId) await db.delete(documents).where(eq(documents.id, documentId));
    const storedRows = objectKeys.length ? await db.select().from(storageObjects).where(inArray(storageObjects.objectKey, objectKeys)) : [];
    if (artifactObjectId) { const artifact = await db.query.storageObjects.findFirst({ where: eq(storageObjects.id, artifactObjectId) }); if (artifact) { storedRows.push(artifact); objectKeys.push(artifact.objectKey); } }
    if (storedRows.length) await db.delete(storageObjects).where(inArray(storageObjects.id, [...new Set(storedRows.map((row) => row.id))]));
    for (const key of [...new Set(objectKeys)]) await objectStorage.remove(key);
    if (jobIds.length) await db.delete(durableJobs).where(inArray(durableJobs.id, [...new Set(jobIds)]));
    if (gateId && originalGateStatus) await db.update(gates).set({ status: originalGateStatus as "not_started" | "in_review" | "ready" | "blocked" | "approved", updatedAt: new Date() }).where(eq(gates.id, gateId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

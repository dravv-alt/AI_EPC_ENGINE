import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { documents, documentVersions, knowledgeChunks, projects, requirements, scheduleResources, scheduleTasks, sourceRegions } from "@/lib/db/schema";
import { getModelProvider } from "@/lib/model/provider";
import { enqueueDurableJob } from "@/lib/jobs/queue";

const requirementProposalSchema = z.object({ proposals: z.array(z.object({ regionId: z.string().uuid(), statement: z.string().min(8).max(10000), modality: z.enum(["shall", "must", "should", "may", "informative"]), numericValue: z.number().finite().nullable(), unit: z.string().max(40).nullable(), tolerance: z.number().nonnegative().nullable(), confidence: z.number().min(0).max(1), validationIssues: z.array(z.string().max(200)).max(20) })).max(500) });
const scheduleProposalSchema = z.object({ tasks: z.array(z.object({ regionId: z.string().uuid(), name: z.string().min(3).max(240), durationHours: z.number().int().positive().max(100000), vendor: z.string().max(200).nullable(), leadTimeDays: z.number().int().nonnegative().nullable(), deadlineType: z.enum(["hard", "soft"]).nullable(), confidence: z.number().min(0).max(1), validationIssues: z.array(z.string().max(200)).max(20) })).max(1000), resources: z.array(z.object({ regionId: z.string().uuid(), name: z.string().min(2).max(200), capacity: z.number().int().positive().max(100000), unit: z.string().min(1).max(60), confidence: z.number().min(0).max(1), validationIssues: z.array(z.string().max(200)).max(20) })).max(200) });
const scheduleDocumentTypes = new Set(["contract", "timeline", "po", "approval", "schedule"]);
const supportedUnits = new Set(["A", "V", "kV", "W", "kW", "MW", "Hz", "bar", "kPa", "Pa", "psi", "°C", "C", "%", "l/s", "L/s", "m3/h", "m³/h", "rpm", "mm", "cm", "m", "ms", "s", "min", "h", "day", "days"]);

function numericFromText(text: string) {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(kPa|Pa|bar|psi|kV|V|MW|kW|W|Hz|°C|C|%|l\/s|L\/s|m3\/h|m³\/h|rpm|mm|cm|m|ms|s|min|h|days?)(?:\s*[±+]\s*(\d+(?:\.\d+)?))?/i);
  return match ? { numericValue: Number(match[1]), unit: match[2], tolerance: match[3] ? Number(match[3]) : null } : { numericValue: null, unit: null, tolerance: null };
}

// Materializes controlled source regions into knowledge_chunks (once per region)
// and enqueues an embedding backfill so semantic retrieval can index newly
// ingested content. Idempotent: regions already indexed are skipped.
async function indexKnowledgeChunks(projectId: string, documentType: string, regions: Array<typeof sourceRegions.$inferSelect>) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return;
  const existing = await db.select({ sourceRegionId: knowledgeChunks.sourceRegionId }).from(knowledgeChunks).where(and(eq(knowledgeChunks.projectId, projectId), inArray(knowledgeChunks.sourceRegionId, regions.map((region) => region.id))));
  const indexed = new Set(existing.map((row) => row.sourceRegionId));
  const fresh = regions.filter((region) => !indexed.has(region.id));
  if (!fresh.length) return;
  await db.insert(knowledgeChunks).values(fresh.map((region) => ({ tenantId: project.tenantId, projectId, sourceRegionId: region.id, documentType, content: region.extractedText, contentHash: region.contentHash }))).onConflictDoNothing();
  await enqueueDurableJob({ queue: "core", name: "knowledge.embed", tenantId: project.tenantId, projectId, idempotencyKey: `knowledge-embed:${projectId}`, payload: { projectId } });
}

export async function proposeDocumentRecords(documentVersionId: string, actorId: string) {
  const versionRows = await db.select({ version: documentVersions, document: documents }).from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(eq(documentVersions.id, documentVersionId)).limit(1);
  const context = versionRows[0]; if (!context) throw new Error("Document version is missing.");
  const regions = await db.select().from(sourceRegions).where(eq(sourceRegions.documentVersionId, documentVersionId));
  if (!regions.length) return { proposed: 0, kind: "none", reason: "No extracted regions." };
  const regionIds = new Set(regions.map((region) => region.id));
  const provider = getModelProvider();
  const sourcePayload = regions.map((region) => ({ regionId: region.id, page: Number(region.pageNumber), text: region.extractedText, contentHash: region.contentHash }));

  await indexKnowledgeChunks(context.document.projectId, context.document.documentType, regions);

  if (scheduleDocumentTypes.has(context.document.documentType)) {
    const existing = await db.select({ id: scheduleTasks.id }).from(scheduleTasks).where(and(eq(scheduleTasks.projectId, context.document.projectId), inArray(scheduleTasks.sourceRegionId, regions.map((region) => region.id))));
    if (existing.length) return { proposed: 0, kind: "schedule", duplicate: true };
    const mock = { tasks: regions.slice(0, 20).map((region, index) => ({ regionId: region.id, name: region.extractedText.split(/[.!?\n]/)[0]?.trim().slice(0, 240) || `Extracted task ${index + 1}`, durationHours: 8, vendor: null, leadTimeDays: null, deadlineType: "soft" as const, confidence: 0.55, validationIssues: ["Duration was not explicit and requires reviewer correction.", "Vendor/dependency fields require review."] })), resources: [] };
    const generated = await provider.generateStructured({ system: "Extract schedule task and resource-capacity proposals. Every row must cite exactly one supplied regionId. Never invent a citation. Flag every ambiguous or missing field in validationIssues. Output only JSON.", prompt: JSON.stringify({ documentType: context.document.documentType, regions: sourcePayload }), schema: scheduleProposalSchema, mock });
    if (generated.data.tasks.some((item) => !regionIds.has(item.regionId)) || generated.data.resources.some((item) => !regionIds.has(item.regionId))) throw new Error("Model output contained an uncited or cross-document schedule proposal.");
    const inserted = await db.transaction(async (tx) => {
      const taskRows = generated.data.tasks.length ? await tx.insert(scheduleTasks).values(generated.data.tasks.map((item) => ({ projectId: context.document.projectId, sourceRegionId: item.regionId, name: item.name, durationHours: item.durationHours, vendor: item.vendor, leadTimeDays: item.leadTimeDays, deadlineType: item.deadlineType, confidence: String(item.confidence), validationIssues: item.validationIssues, reviewState: "proposed" as const }))).returning() : [];
      const resourceRows = generated.data.resources.length ? await tx.insert(scheduleResources).values(generated.data.resources.map((item) => ({ projectId: context.document.projectId, sourceRegionId: item.regionId, name: item.name, capacity: item.capacity, unit: item.unit, confidence: String(item.confidence), validationIssues: item.validationIssues, reviewState: "proposed" as const }))).onConflictDoNothing().returning() : [];
      return [...taskRows.map((row) => ({ id: row.id, type: "schedule_task" })), ...resourceRows.map((row) => ({ id: row.id, type: "schedule_resource" }))];
    });
    for (const row of inserted) await writeAuditEvent({ projectId: context.document.projectId, actorId, action: `${row.type}.model_proposed`, entityType: row.type, entityId: row.id, after: { documentVersionId, model: generated.model, advisory: true } });
    return { proposed: inserted.length, kind: "schedule", provider: generated.provider, model: generated.model };
  }

  const existing = await db.select({ id: requirements.id }).from(requirements).where(and(eq(requirements.projectId, context.document.projectId), inArray(requirements.sourceRegionId, regions.map((region) => region.id))));
  if (existing.length) return { proposed: 0, kind: "requirements", duplicate: true };
  const mock = { proposals: regions.filter((region) => /\b(shall|must|should|may)\b/i.test(region.extractedText)).slice(0, 100).map((region) => { const numeric = numericFromText(region.extractedText); const modality = (region.extractedText.match(/\b(shall|must|should|may)\b/i)?.[1]?.toLowerCase() ?? "informative") as "shall" | "must" | "should" | "may" | "informative"; return { regionId: region.id, statement: region.extractedText.slice(0, 10000), modality, ...numeric, confidence: 0.8, validationIssues: numeric.unit && !supportedUnits.has(numeric.unit) ? [`Unsupported unit ${numeric.unit}.`] : [] }; }) };
  const generated = await provider.generateStructured({ system: "Extract atomic requirement proposals from controlled source regions. Every proposal must cite exactly one supplied regionId. Preserve modality, numeric value, normalized unit, tolerance and confidence. Never invent a citation. Output only JSON.", prompt: JSON.stringify({ documentType: context.document.documentType, regions: sourcePayload }), schema: requirementProposalSchema, mock });
  if (generated.data.proposals.some((item) => !regionIds.has(item.regionId))) throw new Error("Model output contained an uncited or cross-document requirement proposal.");
  const valid = generated.data.proposals.filter((item) => !item.unit || supportedUnits.has(item.unit));
  const rows = valid.length ? await db.insert(requirements).values(valid.map((item) => ({ projectId: context.document.projectId, sourceRegionId: item.regionId, statement: item.statement, modality: item.modality, numericValue: item.numericValue === null ? null : String(item.numericValue), unit: item.unit, tolerance: item.tolerance === null ? null : String(item.tolerance), confidence: String(item.confidence), reviewState: "proposed" as const, reviewNote: item.validationIssues.length ? `Validation flags: ${item.validationIssues.join(" ")}` : null }))).returning() : [];
  for (const row of rows) await writeAuditEvent({ projectId: context.document.projectId, actorId, action: "requirement.model_proposed", entityType: "requirement", entityId: row.id, after: { documentVersionId, sourceRegionId: row.sourceRegionId, model: generated.model, advisory: true } });
  return { proposed: rows.length, rejectedByValidation: generated.data.proposals.length - valid.length, kind: "requirements", provider: generated.provider, model: generated.model };
}

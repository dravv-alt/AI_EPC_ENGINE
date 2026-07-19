import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { semanticSearch } from "@/lib/knowledge/query";
import { env } from "@/lib/env";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { canonicalJson } from "@/lib/crypto/canonical-json";
import { db } from "@/lib/db/client";
import { assets, cxChecklistSteps, cxChecklists, cxClauseCitations, cxStepResults, cxTestRecords, documentVersions, documents, gates, sourceRegions, systems } from "@/lib/db/schema";
import { getModelProvider } from "@/lib/model/provider";

const generatedStepSchema = z.object({
  instruction: z.string().trim().min(8).max(4000),
  modality: z.enum(["numeric", "boolean", "narrative"]),
  parameter: z.string().trim().min(1).max(200).nullable(),
  nominalValue: z.number().finite().nullable(),
  unit: z.string().trim().min(1).max(40).nullable(),
  tolerance: z.number().nonnegative().nullable(),
  expectedBoolean: z.boolean().nullable(),
  narrativeCriterion: z.string().trim().min(3).max(4000).nullable(),
  required: z.boolean(),
  citations: z.array(z.object({ regionId: z.string().uuid(), clauseReference: z.string().trim().min(1).max(200) })).min(1).max(10)
}).superRefine((step, context) => {
  if (step.modality === "numeric" && (step.nominalValue === null || !step.unit)) context.addIssue({ code: "custom", message: "Numeric steps require a nominal value and unit." });
  if (step.modality === "boolean" && step.expectedBoolean === null) context.addIssue({ code: "custom", message: "Boolean steps require an expected value." });
  if (step.modality === "narrative" && !step.narrativeCriterion) context.addIssue({ code: "custom", message: "Narrative steps require a human-review criterion." });
});

const checklistDraftSchema = z.object({ steps: z.array(generatedStepSchema).min(1).max(100) });
const reportNarrativeSchema = z.object({ executiveSummary: z.string().trim().min(20).max(4000), conclusion: z.string().trim().min(10).max(2000) });

export const editableReportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  label: z.literal("DRAFT — PENDING ENGINEER REVIEW"),
  title: z.string().trim().min(3).max(300),
  executiveSummary: z.string().trim().min(20).max(4000),
  conclusion: z.string().trim().min(10).max(2000),
  generatedAt: z.string().datetime(),
  checklistId: z.string().uuid(),
  testRecordId: z.string().uuid(),
  steps: z.array(z.object({ stepId: z.string().uuid(), sequenceNumber: z.string(), instruction: z.string(), modality: z.string(), reading: z.union([z.string(), z.number(), z.boolean(), z.null()]), verdict: z.enum(["proposed_pass", "proposed_fail", "needs_human_review"]), enteredBy: z.string().uuid(), enteredAt: z.string().datetime(), citations: z.array(z.object({ sourceRegionId: z.string().uuid(), clauseReference: z.string(), verificationStatus: z.string() })) })),
  deviations: z.array(z.object({ stepId: z.string().uuid(), verdict: z.string(), findingId: z.string().uuid().nullable() }))
});

export type EditableCxReport = z.infer<typeof editableReportSchema>;

function mockStep(region: typeof sourceRegions.$inferSelect, index: number): z.infer<typeof generatedStepSchema> {
  const numeric = region.extractedText.match(/(-?\d+(?:\.\d+)?)\s*(kPa|Pa|bar|psi|kV|V|MW|kW|W|Hz|°C|C|%|l\/s|L\/s|m3\/h|m³\/h|rpm|mm|cm|m)(?:\s*[±+]\s*(\d+(?:\.\d+)?))?/i);
  const citation = [{ regionId: region.id, clauseReference: `Page ${region.pageNumber} · ${region.contentHash.slice(0, 12)}` }];
  const sentence = region.extractedText.split(/(?<=[.!?])\s+|\n/).find((value) => value.trim().length >= 8)?.trim().slice(0, 3900) ?? `Review controlled clause ${index + 1}.`;
  if (numeric) return { instruction: sentence, modality: "numeric", parameter: `Controlled parameter ${index + 1}`, nominalValue: Number(numeric[1]), unit: numeric[2], tolerance: numeric[3] ? Number(numeric[3]) : 0, expectedBoolean: null, narrativeCriterion: null, required: true, citations: citation };
  if (/\b(verify|confirm|ensure|present|provided|interlock|available)\b/i.test(sentence)) return { instruction: sentence, modality: "boolean", parameter: null, nominalValue: null, unit: null, tolerance: null, expectedBoolean: true, narrativeCriterion: null, required: true, citations: citation };
  return { instruction: sentence, modality: "narrative", parameter: null, nominalValue: null, unit: null, tolerance: null, expectedBoolean: null, narrativeCriterion: "Engineer must document whether the cited controlled criterion is satisfied.", required: true, citations: citation };
}

export async function generateChecklistDraft(checklistId: string, actorId: string) {
  const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, checklistId) });
  if (!checklist) throw new Error("Checklist job references a missing checklist.");
  try {
    const versionIds = (checklist.standardVersionIds as string[]).filter((value) => z.string().uuid().safeParse(value).success);
    const [system, gate, asset] = await Promise.all([
      db.query.systems.findFirst({ where: and(eq(systems.id, checklist.systemId), eq(systems.projectId, checklist.projectId)) }),
      db.query.gates.findFirst({ where: and(eq(gates.id, checklist.gateId), eq(gates.projectId, checklist.projectId)) }),
      db.query.assets.findFirst({ where: and(eq(assets.id, checklist.assetId), eq(assets.projectId, checklist.projectId)) }),
    ]);
    if (!system || !gate || !asset) throw new Error("Checklist scope is no longer valid for this project.");

    // Try semantic search first, fall back to FK join
    let regionRows: Array<{ region: typeof sourceRegions.$inferSelect; version: typeof documentVersions.$inferSelect; document: typeof documents.$inferSelect }> = [];
    if (env.GEMINI_API_KEY && versionIds.length) {
      const searchQuery = `${system.name} ${gate.name} ${asset.tag} commissioning test procedure`;
      const semanticResults = await semanticSearch({ projectId: checklist.projectId, query: searchQuery, limit: 20 });
      // Filter to only regions from selected standard versions
      const semanticRegionIds = new Set(semanticResults.map((r) => r.regionId));
      regionRows = versionIds.length
        ? (await db.select({ region: sourceRegions, version: documentVersions, document: documents })
            .from(sourceRegions)
            .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
            .innerJoin(documents, eq(documentVersions.documentId, documents.id))
            .where(and(inArray(documentVersions.id, versionIds), eq(documents.projectId, checklist.projectId), eq(documentVersions.extractionStatus, "completed"))))
            .filter((row) => semanticRegionIds.has(row.region.id))
        : [];
      // If semantic search returned too few, fall through to full FK join
      if (regionRows.length < 3) regionRows = []; // will be re-fetched below
    }
    if (!regionRows.length) {
      regionRows = versionIds.length
        ? await db.select({ region: sourceRegions, version: documentVersions, document: documents })
            .from(sourceRegions)
            .innerJoin(documentVersions, eq(sourceRegions.documentVersionId, documentVersions.id))
            .innerJoin(documents, eq(documentVersions.documentId, documents.id))
            .where(and(inArray(documentVersions.id, versionIds), eq(documents.projectId, checklist.projectId), eq(documentVersions.extractionStatus, "completed")))
        : [];
    }
    if (!regionRows.length) throw new Error("Completed standards/procedures with extracted citation regions are required.");
    const allowedRegions = new Set(regionRows.map((row) => row.region.id));
    const source = regionRows.map((row) => ({ regionId: row.region.id, page: Number(row.region.pageNumber), text: row.region.extractedText, contentHash: row.region.contentHash, standardSet: row.document.standardSet, revision: row.version.revision }));
    const mock = { steps: regionRows.slice(0, 12).map((row, index) => mockStep(row.region, index)) };
    const generated = await getModelProvider().generateStructured({
      system: "Draft a commissioning checklist from only the supplied controlled standard regions. Every step must cite one or more exact supplied regionId values. Numeric and boolean criteria must be explicit in the cited text; otherwise use narrative and require human review. Never certify, approve, or invent a clause. Output JSON only.",
      prompt: JSON.stringify({ system: system.name, gate: gate.name, asset: asset.tag, controlledRegions: source }),
      schema: checklistDraftSchema,
      mock
    });
    if (generated.data.steps.some((step) => step.citations.some((citation) => !allowedRegions.has(citation.regionId)))) throw new Error("Generated checklist contains an uncited or cross-standard clause.");
    await db.transaction(async (tx) => {
      const oldSteps = await tx.select({ id: cxChecklistSteps.id }).from(cxChecklistSteps).where(eq(cxChecklistSteps.checklistId, checklist.id));
      await tx.delete(cxClauseCitations).where(eq(cxClauseCitations.checklistId, checklist.id));
      if (oldSteps.length) await tx.delete(cxChecklistSteps).where(eq(cxChecklistSteps.checklistId, checklist.id));
      for (const [index, step] of generated.data.steps.entries()) {
        const [created] = await tx.insert(cxChecklistSteps).values({ checklistId: checklist.id, sequenceNumber: String(index + 1), instruction: step.instruction, modality: step.modality, parameter: step.parameter, nominalValue: step.nominalValue === null ? null : String(step.nominalValue), unit: step.unit, tolerance: step.tolerance === null ? null : String(step.tolerance), expectedBoolean: step.expectedBoolean, narrativeCriterion: step.narrativeCriterion, required: step.required, reviewState: "proposed" }).returning();
        await tx.insert(cxClauseCitations).values(step.citations.map((citation) => ({ checklistId: checklist.id, stepId: created.id, clauseReference: citation.clauseReference, sourceRegionId: citation.regionId, verificationStatus: "verified", verificationReason: "Region exists in a selected, completed project-scoped standard version." })));
      }
      await tx.update(cxChecklists).set({ generationStatus: "completed", generationError: null, generationModelVersion: generated.model, updatedAt: new Date() }).where(eq(cxChecklists.id, checklist.id));
    });
    await writeAuditEvent({ projectId: checklist.projectId, actorId, action: "cx.checklist.model_drafted", entityType: "cx_checklist", entityId: checklist.id, after: { model: generated.model, provider: generated.provider, stepCount: generated.data.steps.length, standardVersionIds: versionIds, advisory: true } });
    return { checklistId: checklist.id, stepCount: generated.data.steps.length, model: generated.model, provider: generated.provider };
  } catch (error) {
    await db.update(cxChecklists).set({ generationStatus: "failed", generationError: error instanceof Error ? error.message : "Checklist generation failed.", updatedAt: new Date() }).where(eq(cxChecklists.id, checklist.id));
    throw error;
  }
}

export async function generateCxReport(testRecordId: string, actorId: string) {
  const record = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, testRecordId) });
  if (!record) throw new Error("Report job references a missing test record.");
  try {
    if (record.reportStatus === "approved") throw new Error("Approved reports are immutable.");
    const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, record.checklistId) });
    if (!checklist) throw new Error("Checklist is missing.");
    const [steps, results, citations] = await Promise.all([
      db.select().from(cxChecklistSteps).where(and(eq(cxChecklistSteps.checklistId, checklist.id), eq(cxChecklistSteps.reviewState, "accepted"))),
      db.select().from(cxStepResults).where(eq(cxStepResults.testRecordId, record.id)),
      db.select().from(cxClauseCitations).where(eq(cxClauseCitations.checklistId, checklist.id))
    ]);
    const resultByStep = new Map(results.map((result) => [result.stepId, result]));
    const missing = steps.filter((step) => step.required && !resultByStep.has(step.id));
    if (!steps.length || missing.length) throw new Error(`Every required accepted checklist step must be recorded before drafting (${missing.length} missing).`);
    const mockNarrative = { executiveSummary: `This draft records ${steps.length} executed commissioning step${steps.length === 1 ? "" : "s"}. All verdicts remain proposed until engineer review.`, conclusion: results.some((result) => result.verdict === "proposed_fail") ? "One or more deterministic checks produced a proposed failure and require corrective action." : results.some((result) => result.verdict === "needs_human_review") ? "Narrative criteria require explicit engineer judgment before approval." : "All recorded deterministic checks produced proposed-pass verdicts; engineer approval is still required." };
    const narrative = await getModelProvider().generateStructured({ system: "Summarize the supplied immutable commissioning readings without changing values, verdicts, citations, or claiming approval/certification. Output JSON only.", prompt: JSON.stringify({ checklist: checklist.title, steps: steps.map((step) => ({ instruction: step.instruction, result: resultByStep.get(step.id) })) }), schema: reportNarrativeSchema, mock: mockNarrative });
    const content: EditableCxReport = editableReportSchema.parse({ schemaVersion: "1.0", label: "DRAFT — PENDING ENGINEER REVIEW", title: checklist.title, executiveSummary: narrative.data.executiveSummary, conclusion: narrative.data.conclusion, generatedAt: new Date().toISOString(), checklistId: checklist.id, testRecordId: record.id, steps: steps.map((step) => { const result = resultByStep.get(step.id)!; return { stepId: step.id, sequenceNumber: step.sequenceNumber, instruction: step.instruction, modality: step.modality, reading: result.readingValue === null ? result.readingBoolean === null ? result.readingText : result.readingBoolean : Number(result.readingValue), verdict: result.verdict, enteredBy: result.enteredBy, enteredAt: result.enteredAt.toISOString(), citations: citations.filter((citation) => citation.stepId === step.id && citation.sourceRegionId).map((citation) => ({ sourceRegionId: citation.sourceRegionId!, clauseReference: citation.clauseReference, verificationStatus: citation.verificationStatus })) }; }), deviations: results.filter((result) => result.verdict !== "proposed_pass").map((result) => ({ stepId: result.stepId, verdict: result.verdict, findingId: result.findingId })) });
    await db.update(cxTestRecords).set({ reportContent: content, reportContentHash: null, reportGenerationStatus: "completed", reportGenerationError: null, reportModelVersion: narrative.model, updatedAt: new Date() }).where(eq(cxTestRecords.id, record.id));
    const contentDraftHash = createHash("sha256").update(canonicalJson(content)).digest("hex");
    await writeAuditEvent({ projectId: record.projectId, actorId, action: "cx.report.model_drafted", entityType: "cx_test_record", entityId: record.id, after: { model: narrative.model, contentDraftHash, advisory: true } });
    return { testRecordId: record.id, model: narrative.model, content };
  } catch (error) {
    await db.update(cxTestRecords).set({ reportGenerationStatus: "failed", reportGenerationError: error instanceof Error ? error.message : "Report generation failed.", updatedAt: new Date() }).where(eq(cxTestRecords.id, record.id));
    throw error;
  }
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { documentVersions, documents, evidence, siteAnalyses } from "@/lib/db/schema";
import { getGenerationProvider } from "@/lib/model/provider";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

const resultSchema = z.object({
  summary: z.string().trim().min(30).max(1200),
  observations: z.array(z.string().trim().min(8).max(320)).max(8),
  evidenceGaps: z.array(z.string().trim().min(8).max(320)).max(8),
  recommendedActions: z.array(z.string().trim().min(8).max(320)).max(8),
  confidence: z.enum(["low", "medium", "high"]),
});

function numberOf(value: string | undefined) {
  const parsed = Number(value?.replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function deterministicContext(answers: Record<string, string>) {
  const itMw = numberOf(answers.target_it_mw);
  const pue = numberOf(answers.pue_target);
  const liquidShare = numberOf(answers.rack_density);
  const facilityMw = itMw !== null && pue !== null ? Number((itMw * pue).toFixed(2)) : null;
  const liquidMw = itMw !== null && liquidShare !== null ? Number((itMw * liquidShare / 100).toFixed(2)) : null;
  const supply = numberOf(answers.tech_coolant_supply_c);
  const returnTemperature = numberOf(answers.tech_coolant_return_c);
  return {
    architecture: answers.cooling_architecture || "not selected",
    itMw,
    pue,
    estimatedFacilityMw: facilityMw,
    indicatedLiquidHeatMw: liquidMw,
    technologyDeltaTC: supply !== null && returnTemperature !== null ? Number((returnTemperature - supply).toFixed(2)) : null,
    reserve: answers.cooling_capacity_reserve === "yes" ? { liquidPct: numberOf(answers.liquid_capacity_reserve_pct), residualAirPct: numberOf(answers.air_capacity_reserve_pct) } : null,
  };
}

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "audit:view");
    const limited = await enforceAiRateLimit(`site-analysis-cooling:${projectId}:${actor.userId}`);
    if (limited) return limited;
    const [analysis, documentRows, evidenceRows] = await Promise.all([
      db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.projectId, projectId) }),
      db.select({ title: documents.title, revision: documentVersions.revision, extractionStatus: documentVersions.extractionStatus }).from(documents).leftJoin(documentVersions, eq(documentVersions.documentId, documents.id)).where(eq(documents.projectId, projectId)),
      db.select({ evidenceType: evidence.evidenceType, validityState: evidence.validityState, notes: evidence.notes, aiDescription: evidence.aiDescription }).from(evidence).where(eq(evidence.projectId, projectId)),
    ]);
    if (!analysis) return NextResponse.json({ error: "Save Site Analysis before running a cooling analysis." }, { status: 409 });
    const answers = analysis.answers as Record<string, string>;
    const metrics = deterministicContext(answers);
    const evidenceSummary = evidenceRows.map((row) => ({ type: row.evidenceType, state: row.validityState, notes: row.notes?.slice(0, 240) ?? null, aiDescription: row.aiDescription?.slice(0, 240) ?? null }));
    const documentsSummary = documentRows.map((row) => ({ title: row.title, revision: row.revision, extractionStatus: row.extractionStatus }));
    const missing = ["cooling_architecture", "tech_coolant_supply_c", "tech_coolant_return_c", "facility_water_supply_c", "facility_water_return_c", "technology_fluid", "water_boundary", "fluid_evidence"].filter((key) => !answers[key]?.trim());
    const mock = {
      summary: `Cooling planning remains ${missing.length ? "incomplete" : "ready for technical review"}. The selected architecture is ${metrics.architecture}; all outputs remain advisory until controlled equipment and site evidence is reviewed.`,
      observations: [metrics.estimatedFacilityMw === null ? "Target IT load or PUE is missing, so facility demand cannot be estimated." : `Indicative facility demand is ${metrics.estimatedFacilityMw} MW from the saved IT load and PUE assumptions.`, metrics.technologyDeltaTC === null ? "Technology-loop supply and return temperatures are incomplete." : `Saved technology-loop delta-T is ${metrics.technologyDeltaTC} °C.`].filter(Boolean),
      evidenceGaps: missing.length ? missing.map((key) => `Provide or link controlled evidence for ${key.replaceAll("_", " ")}.`) : ["Review all planning values against the linked controlled documents before design release."],
      recommendedActions: ["Link manufacturer data, performance curves, and the applicable controlled source revision.", "Have a qualified engineer review the planning basis before using it for procurement or design release."],
      confidence: missing.length > 4 ? "low" : missing.length ? "medium" : "high" as const,
    };
    // The configured generation provider interprets deterministic metrics;
    // the model remains advisory and cannot create authority or measurements.
    const generated = await getGenerationProvider().generateStructured({
      system: "You are a conservative data-centre cooling planning analyst. Interpret only the supplied project inputs, controlled-document index, and evidence metadata. Never invent measurements, equipment performance, weather values, signatures, certifications, compliance, or approval. Clearly state that recommendations are advisory and require qualified engineering review. Output JSON only.",
      prompt: JSON.stringify({ deterministicMetrics: metrics, coolingInputs: Object.fromEntries(Object.entries(answers).filter(([key]) => key.includes("cool") || key.includes("water") || key.includes("fluid") || key.includes("chiller") || key.includes("pump") || key.includes("dry_") || key.includes("reserve") || key === "target_it_mw" || key === "pue_target" || key === "rack_density")), missingInputs: missing, controlledDocuments: documentsSummary, projectEvidence: evidenceSummary }),
      schema: resultSchema,
      mock,
    });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "site_analysis.cooling_model_drafted", entityType: "site_analysis", entityId: analysis.id, after: { provider: generated.provider, model: generated.model, advisory: true, missingInputCount: missing.length } });
    return NextResponse.json({ analysis: generated.data, metrics, model: generated.model, provider: generated.provider, generatedAt: new Date().toISOString(), advisory: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate cooling analysis." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

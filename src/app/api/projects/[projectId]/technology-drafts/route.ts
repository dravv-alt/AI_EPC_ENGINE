import { createHash, randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { assets, documents, documentVersions, knowledgeChunks, projects, siteAnalyses, sourceRegions, storageObjects, systems, technologyPluginDrafts } from "@/lib/db/schema";
import { activeEmbeddingModelTag, getEmbeddingProvider, getGenerationProvider } from "@/lib/model/provider";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { coolingStatePointFields, siteSections } from "@/lib/site-analysis/questions";
import { detectAllowedCaptureMediaType } from "@/lib/storage/magic";
import { projectObjectContentUrl } from "@/lib/storage/http";
import { objectStorage } from "@/lib/storage/service";
import { createVendorPackagePdf, type VendorPackageContext, type VendorPackageInput, vendorPackageSearchText } from "@/lib/technology/vendor-package";

export const runtime = "nodejs";

const checklistItem = z.string().trim().min(2).max(240);
const schema = z.object({
  templateId: z.string().min(2).max(120), category: z.string().trim().min(2).max(80), solutionName: z.string().trim().min(3).max(200), summary: z.string().trim().min(20).max(5000),
  evidenceChecklist: z.array(checklistItem).min(1).max(30), commercialChecklist: z.array(checklistItem).min(1).max(30),
  claims: z.array(z.object({ type: z.string().trim().min(2).max(100), text: z.string().trim().min(8).max(1000), evidenceRequired: z.string().trim().min(2).max(500) })).min(1).max(10),
  parameters: z.array(z.object({ key: z.string().trim().min(2).max(100), label: z.string().trim().min(2).max(200), unit: z.string().trim().min(1).max(60), sourceHint: z.string().trim().min(2).max(500) })).min(1).max(30),
  vendor: z.object({
    vendorName: z.string().trim().max(200).default(""), productName: z.string().trim().min(2).max(200), modelFamily: z.string().trim().max(200).optional(), contactName: z.string().trim().max(200).optional(), contactEmail: z.string().trim().email().max(250).or(z.literal("")).optional(), contactPhone: z.string().trim().max(80).optional(), vendorAddress: z.string().trim().max(500).optional(), manufacturer: z.string().trim().max(200).optional(), purchaserSignatoryName: z.string().trim().max(200).optional(), purchaserSignatoryTitle: z.string().trim().max(200).optional(), vendorSignatoryName: z.string().trim().max(200).optional(), vendorSignatoryTitle: z.string().trim().max(200).optional(),
  }),
  procurement: z.object({
    referenceNumber: z.string().trim().min(2).max(100), issueDate: z.string().trim().min(8).max(30), responseDueDate: z.string().trim().max(30).optional(), deliveryLocation: z.string().trim().max(300).optional(), requiredDeliveryDate: z.string().trim().max(30).optional(), quantityBasis: z.string().trim().max(300).optional(), quotationValidityDays: z.coerce.number().int().min(1).max(365).optional(), currency: z.string().trim().max(20).optional(), incoterms: z.string().trim().max(100).optional(), paymentTerms: z.string().trim().max(500).optional(), warrantyRequirements: z.string().trim().max(500).optional(), supportRequirements: z.string().trim().max(500).optional(), installationCommissioningScope: z.string().trim().max(800).optional(), evaluationCriteria: z.string().trim().max(800).optional(), specialTerms: z.string().trim().max(1000).optional(),
  }),
});

const generatedMessageSchema = z.object({ subject: z.string().trim().min(5).max(180), message: z.string().trim().min(80).max(1800), useCaseSummary: z.string().trim().min(30).max(900) });
const sectionByCategory: Record<string, string[]> = {
  cooling: ["cooling", "rack_plan", "power", "availability", "site_fit"], power: ["power", "availability", "rack_plan", "schedule_commissioning"], "it / oem": ["workload_platform", "rack_plan", "network_storage", "cooling"], "electrical infrastructure": ["power", "availability", "building_systems", "schedule_commissioning"], "mechanical / water": ["cooling", "site_fit", "building_systems", "availability"], "controls / software": ["controls_security", "network_storage", "availability"], procurement: ["commercial_responsibilities", "logistics", "schedule_commissioning", "rack_plan"], "permitting / advisory": ["project", "site_fit", "schedule_commissioning", "commercial_responsibilities"],
};

function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : ""; }
function siteLabelMap() {
  const pairs: Array<readonly [string, { section: string; sectionId: string; label: string }]> = siteSections.flatMap((section) => section.questions.map((question) => [question.key, { section: section.title, sectionId: section.id, label: question.label }] as const));
  for (const [key, label] of coolingStatePointFields) pairs.push([key, { section: "Cooling", sectionId: "cooling", label }]);
  return new Map(pairs);
}

async function contextFor(projectId: string, category: string): Promise<{ project: typeof projects.$inferSelect; context: VendorPackageContext }> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new AccessError("Project not found.", 404);
  const [analysis, systemRows, assetRows] = await Promise.all([db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.projectId, projectId) }), db.select().from(systems).where(eq(systems.projectId, projectId)), db.select().from(assets).where(eq(assets.projectId, projectId))]);
  const answers = (analysis?.answers ?? {}) as Record<string, unknown>;
  const labels = siteLabelMap();
  const relevantSections = new Set(sectionByCategory[category.toLowerCase()] ?? siteSections.map((section) => section.id));
  const siteAnalysis = Object.entries(answers).flatMap(([key, raw]) => {
    const value = stringValue(raw); const label = labels.get(key);
    return value && label && relevantSections.has(label.sectionId) ? [{ section: label.section, label: label.label, value }] : [];
  }).slice(0, 45);
  const contextSystems = systemRows.map((system) => ({ name: system.name, type: system.systemType, assets: assetRows.filter((asset) => asset.systemId === system.id).map((asset) => `${asset.tag} (${asset.assetType}${asset.vendor ? ` · ${asset.vendor}` : ""})`) }));
  return { project, context: { project: { name: project.name, code: project.code, timezone: project.timezone }, siteAnalysis, systems: contextSystems } };
}

function fallbackMessage(input: z.infer<typeof schema>, context: VendorPackageContext) {
  const siteBasis = context.siteAnalysis.slice(0, 5).map((item) => `${item.label}: ${item.value}`).join("; ");
  const systemBasis = context.systems.slice(0, 4).map((item) => item.name).join(", ");
  return {
    subject: `${input.procurement.referenceNumber}: ${input.solutionName} vendor response requested`,
    message: `Please provide a complete technical and commercial response for ${input.vendor.productName} for ${context.project.name}. The response must identify the exact model, state all assumptions and deviations, complete the attached parameter schedule, and cite the revision and page for every claimed value. Attach the requested datasheets, drawings, performance evidence, delivery basis, warranty and commissioning responsibility split. ${siteBasis ? `The supplied planning basis includes ${siteBasis}.` : "No verified Site Analysis values are supplied; state every planning assumption explicitly."}`,
    useCaseSummary: `${input.summary}${systemBasis ? ` The package may interface with the following registered project systems: ${systemBasis}.` : " No controlled project systems are currently registered."}`,
  };
}

async function generateMessage(input: z.infer<typeof schema>, context: VendorPackageContext) {
  const fallback = fallbackMessage(input, context);
  try {
    const result = await getGenerationProvider().generateStructured({ schema: generatedMessageSchema, mock: fallback, system: "You draft concise vendor RFQ/RFI cover messages for engineering procurement. Use only supplied facts. Never invent measurements, certifications, approvals, vendors, dates, prices, performance, or evidence. Clearly identify unknowns and request citations.", prompt: JSON.stringify({ project: context.project, category: input.category, solution: input.solutionName, vendor: input.vendor, procurement: input.procurement, summary: input.summary, siteAnalysis: context.siteAnalysis, systems: context.systems, evidenceChecklist: input.evidenceChecklist, commercialChecklist: input.commercialChecklist }) });
    return { ...result.data, provider: result.provider, model: result.model };
  } catch { return { ...fallback, provider: "deterministic-fallback", model: null }; }
}

async function optionalImage(form: FormData, key: string, maxBytes: number) {
  const file = form.get(key);
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > maxBytes) throw new AccessError(`${key} image is too large.`, 413);
  const bytes = Buffer.from(await file.arrayBuffer()); const mediaType = detectAllowedCaptureMediaType(bytes, file.type);
  if (mediaType !== "image/png" && mediaType !== "image/jpeg") throw new AccessError(`${key} must be a PNG or JPEG image.`, 415);
  return bytes;
}

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ drafts: await db.select().from(technologyPluginDrafts).where(eq(technologyPluginDrafts.projectId, projectId)).orderBy(desc(technologyPluginDrafts.updatedAt)) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load technology drafts." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; let storedKey: string | null = null; let committed = false;
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage"); const form = await request.formData();
    let json: unknown = null; try { json = JSON.parse(String(form.get("payload") ?? "null")); } catch { return NextResponse.json({ error: "Vendor package payload is not valid JSON." }, { status: 400 }); }
    const parsed = schema.safeParse(json); if (!parsed.success) return NextResponse.json({ error: "Vendor package is incomplete or invalid.", issues: parsed.error.flatten() }, { status: 400 });
    const [letterhead, purchaserSignature, vendorSignature] = await Promise.all([optionalImage(form, "letterhead", 2 * 1024 * 1024), optionalImage(form, "purchaserSignature", 1024 * 1024), optionalImage(form, "vendorSignature", 1024 * 1024)]);
    const { project, context } = await contextFor(projectId, parsed.data.category); const generated = await generateMessage(parsed.data, context);
    const packageInput: VendorPackageInput = { ...parsed.data, summary: generated.useCaseSummary, context, draftMessage: generated.message };
    const draftId = randomUUID(); const searchText = vendorPackageSearchText(packageInput); const embedding = await getEmbeddingProvider().embed(searchText);
    const pdf = await createVendorPackagePdf(packageInput, { letterhead, purchaserSignature, vendorSignature });
    const safeReference = parsed.data.procurement.referenceNumber.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
    const stored = await objectStorage.put({ tenantId: project.tenantId, projectId, bytes: pdf, mediaType: "application/pdf", fileName: `${safeReference}-vendor-package.pdf` }); storedKey = stored.objectKey;
    const contentHash = createHash("sha256").update(`${draftId}\n${searchText}`).digest("hex");
    const result = await db.transaction(async (tx) => {
      const [object] = await tx.insert(storageObjects).values({ tenantId: project.tenantId, projectId, objectKey: stored.objectKey, mediaType: stored.mediaType, byteSize: stored.byteSize, sha256: stored.sha256, createdBy: actor.userId }).returning();
      const [document] = await tx.insert(documents).values({ projectId, documentType: "vendor_request", standardSet: "Technology Draft Studio", title: `${parsed.data.procurement.referenceNumber} — ${parsed.data.solutionName}` }).returning();
      const [version] = await tx.insert(documentVersions).values({ documentId: document.id, revision: "Draft 1", sha256: stored.sha256, objectKey: stored.objectKey, mediaType: stored.mediaType, extractionStatus: "completed", extractionModel: "technology-vendor-package-v1", extractionProvider: "rules" }).returning();
      const [region] = await tx.insert(sourceRegions).values({ documentVersionId: version.id, pageNumber: "1", extractedText: searchText, contentHash }).returning();
      await tx.insert(knowledgeChunks).values({ tenantId: project.tenantId, projectId, sourceRegionId: region.id, documentType: "vendor_request", content: searchText, contentHash, embedding, embeddingModel: activeEmbeddingModelTag() });
      const [draft] = await tx.insert(technologyPluginDrafts).values({ id: draftId, projectId, templateId: parsed.data.templateId, category: parsed.data.category, solutionName: parsed.data.solutionName, summary: generated.useCaseSummary, evidenceChecklist: parsed.data.evidenceChecklist, claims: parsed.data.claims, parameters: parsed.data.parameters, commercialChecklist: parsed.data.commercialChecklist, vendorDetails: parsed.data.vendor, procurementDetails: parsed.data.procurement, projectContext: context, draftMessage: generated.message, generationProvider: generated.provider, generationModel: generated.model, artifactObjectId: object.id, documentVersionId: version.id, status: "draft" }).returning();
      return { draft, document, version, object };
    });
    committed = true;
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "technology_draft.vendor_package_created", entityType: "technology_draft", entityId: result.draft.id, after: { templateId: result.draft.templateId, category: result.draft.category, status: "draft", documentVersionId: result.version.id, artifactObjectId: result.object.id, embeddingModel: activeEmbeddingModelTag(), generationProvider: generated.provider, publishable: false } });
    const downloadUrl = projectObjectContentUrl(projectId, result.object.id, request.url); return NextResponse.json({ ...result, downloadUrl, generatedSubject: generated.subject }, { status: 201 });
  } catch (error) {
    if (storedKey && !committed) await objectStorage.remove(storedKey);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create the vendor package." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  assets,
  cxClauseCitations,
  cxChecklistSteps,
  cxChecklists,
  documentVersions,
  documents,
  gates,
  projects,
  requirements,
  scheduleTasks,
  sourceRegions,
  storageObjects,
  systems,
} from "@/lib/db/schema";
import { objectStorage } from "@/lib/storage/service";
import { siteSections, type SiteAnswerMap } from "@/lib/site-analysis/questions";

const TECHNICAL_SECTIONS = new Set([
  "racks",
  "campus",
  "site_fit",
  "power",
  "availability",
  "cooling",
  "building_systems",
  "network",
  "logistics",
  "controls",
  "schedule",
]);

const sectionSystemType: Record<string, string> = {
  racks: "technology",
  campus: "physical",
  site_fit: "site",
  power: "electrical",
  availability: "resilience",
  cooling: "mechanical",
  building_systems: "building",
  network: "network",
  logistics: "logistics",
  controls: "controls_security",
  schedule: "commissioning",
};

function textBasis(answers: SiteAnswerMap) {
  const lines = [
    "# Confirmed Site Analysis planning basis",
    "",
    "This document records user-confirmed planning inputs. It is not a stamped design, vendor approval, utility commitment, or commissioning acceptance.",
    "",
  ];
  for (const section of siteSections) {
    const populated = section.questions.filter((q) => answers[q.key]?.trim());
    if (!populated.length) continue;
    lines.push(`## ${section.title}`, "");
    for (const question of populated)
      lines.push(`- ${question.label}: ${answers[question.key].trim()}`);
    lines.push("");
  }
  return lines.join("\n");
}

function stepInstruction(sectionTitle: string, label: string, value: string) {
  return `Verify the ${sectionTitle.toLowerCase()} planning decision “${label}” against the installed condition and the controlling approved source. Recorded planning value: ${value}.`;
}

export async function finalizeSiteAnalysis(input: {
  projectId: string;
  actorId: string;
  analysisId: string;
  answers: SiteAnswerMap;
}) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });
  if (!project) throw new Error("Project not found.");

  const markdown = textBasis(input.answers);
  const bytes = Buffer.from(markdown, "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let document = await db.query.documents.findFirst({
    where: and(
      eq(documents.projectId, input.projectId),
      eq(documents.title, "Site Analysis — confirmed planning basis"),
    ),
  });
  if (!document) {
    [document] = await db
      .insert(documents)
      .values({
        projectId: input.projectId,
        documentType: "planning_basis",
        standardSet: "Site Analysis",
        title: "Site Analysis — confirmed planning basis",
      })
      .returning();
  }

  const latestVersions = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, document.id))
    .orderBy(desc(documentVersions.createdAt));
  let version = latestVersions.find((item) => item.sha256 === sha256);
  let region: typeof sourceRegions.$inferSelect | undefined;
  if (!version) {
    const stored = await objectStorage.put({
      tenantId: project.tenantId,
      projectId: input.projectId,
      bytes,
      mediaType: "text/markdown",
      fileName: "site-analysis-planning-basis.md",
    });
    await db
      .insert(storageObjects)
      .values({
        tenantId: project.tenantId,
        projectId: input.projectId,
        objectKey: stored.objectKey,
        mediaType: stored.mediaType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        createdBy: input.actorId,
      })
      .onConflictDoNothing({ target: storageObjects.objectKey });
    if (latestVersions.length)
      await db
        .update(documentVersions)
        .set({ status: "superseded", updatedAt: new Date() })
        .where(eq(documentVersions.id, latestVersions[0].id));
    [version] = await db
      .insert(documentVersions)
      .values({
        documentId: document.id,
        revision: `Site Analysis v${latestVersions.length + 1}`,
        status: "approved",
        sha256,
        objectKey: stored.objectKey,
        mediaType: stored.mediaType,
        extractionStatus: "completed",
        extractionModel: "deterministic-site-analysis-v1",
        extractionProvider: "rules",
      })
      .returning();
    [region] = await db
      .insert(sourceRegions)
      .values({
        documentVersionId: version.id,
        pageNumber: "1",
        extractedText: markdown,
        contentHash: sha256,
      })
      .returning();
    if (!region) throw new Error("Could not create the Site Analysis source region.");
    const sourceRegionId = region.id;

    const requirementRows = siteSections.flatMap((section) =>
      section.questions
        .filter((question) => input.answers[question.key]?.trim())
        .map((question) => ({
          projectId: input.projectId,
          sourceRegionId,
          statement: `${question.label}: ${input.answers[question.key].trim()}`,
          displayTitle: question.label.slice(0, 180),
          displaySummary: `${section.title} planning input · ${input.answers[question.key].trim()}`.slice(0, 280),
          presentationProvider: "deterministic-site-analysis-v1",
          modality: "informative",
          comparisonModality: "categorical",
          reviewState: "proposed" as const,
          confidence: "0.8000",
        })),
    );
    if (requirementRows.length)
      await db.insert(requirements).values(requirementRows);
  } else {
    region = await db.query.sourceRegions.findFirst({
      where: eq(sourceRegions.documentVersionId, version.id),
    });
  }
  if (!region) throw new Error("Site Analysis source region is unavailable.");

  let systemCount = 0;
  let assetCount = 0;
  let checklistCount = 0;
  let taskCount = 0;
  for (const [sectionIndex, section] of siteSections.entries()) {
    if (section.id === "review") continue;
    const answered = section.questions.filter((q) => input.answers[q.key]?.trim());
    if (!answered.length) continue;

    const taskName = `Site Analysis handoff · ${section.title}`;
    const existingTask = await db.query.scheduleTasks.findFirst({
      where: and(
        eq(scheduleTasks.projectId, input.projectId),
        eq(scheduleTasks.name, taskName),
      ),
    });
    const taskValues = {
      sourceRegionId: region.id,
      durationHours: Math.max(4, answered.length * 2),
      confidence: "0.8000",
      validationIssues: [
        "Planning-derived task. Confirm scope, owner, dates, and controlling evidence before execution.",
      ],
      reviewState: "proposed" as const,
      reviewNote: `Generated from finalized Site Analysis section ${section.title}.`,
      updatedAt: new Date(),
    };
    if (existingTask)
      await db.update(scheduleTasks).set(taskValues).where(eq(scheduleTasks.id, existingTask.id));
    else
      await db.insert(scheduleTasks).values({ projectId: input.projectId, name: taskName, ...taskValues });
    taskCount += 1;

    if (!TECHNICAL_SECTIONS.has(section.id)) continue;
    const systemName = `${section.title} planning system`;
    const [system] = await db
      .insert(systems)
      .values({
        projectId: input.projectId,
        name: systemName,
        systemType: sectionSystemType[section.id] ?? "planning",
      })
      .onConflictDoUpdate({
        target: [systems.projectId, systems.name],
        set: { systemType: sectionSystemType[section.id] ?? "planning", updatedAt: new Date() },
      })
      .returning();
    systemCount += 1;

    const assetTag = `SA-${String(sectionIndex + 1).padStart(2, "0")}-BOUNDARY`;
    const [asset] = await db
      .insert(assets)
      .values({
        projectId: input.projectId,
        systemId: system.id,
        tag: assetTag,
        assetType: `${section.title} verification boundary`,
      })
      .onConflictDoUpdate({
        target: [assets.projectId, assets.tag],
        set: { systemId: system.id, assetType: `${section.title} verification boundary`, updatedAt: new Date() },
      })
      .returning();
    assetCount += 1;

    const [gate] = await db
      .insert(gates)
      .values({
        projectId: input.projectId,
        systemId: system.id,
        name: `${section.title} verification`,
        sequenceNumber: String(sectionIndex + 1),
        status: "not_started",
      })
      .onConflictDoUpdate({
        target: [gates.projectId, gates.systemId, gates.name],
        set: { sequenceNumber: String(sectionIndex + 1), updatedAt: new Date() },
      })
      .returning();

    const checklistTitle = `${section.title} · Site Analysis verification plan · ${version.revision}`;
    let checklist = await db.query.cxChecklists.findFirst({
      where: and(
        eq(cxChecklists.projectId, input.projectId),
        eq(cxChecklists.title, checklistTitle),
      ),
    });
    if (!checklist) {
      [checklist] = await db
        .insert(cxChecklists)
        .values({
          tenantId: project.tenantId,
          projectId: input.projectId,
          systemId: system.id,
          gateId: gate.id,
          assetId: asset.id,
          title: checklistTitle,
          status: "draft",
          standardVersionIds: [version.id],
          generationStatus: "completed",
          generationModelVersion: "deterministic-site-analysis-v1",
          createdBy: input.actorId,
          reviewNote: "Planning-derived advisory checklist. Engineer review and controlled standards are required before execution.",
        })
        .returning();
    } else {
      await db
        .update(cxChecklists)
        .set({
          systemId: system.id,
          gateId: gate.id,
          assetId: asset.id,
          standardVersionIds: [version.id],
          generationStatus: "completed",
          generationModelVersion: "deterministic-site-analysis-v1",
          updatedAt: new Date(),
        })
        .where(eq(cxChecklists.id, checklist.id));
    }
    checklistCount += 1;
    const existingSteps = await db
      .select()
      .from(cxChecklistSteps)
      .where(eq(cxChecklistSteps.checklistId, checklist.id));
    const existingCitations = await db
      .select()
      .from(cxClauseCitations)
      .where(eq(cxClauseCitations.checklistId, checklist.id));
    for (const [questionIndex, question] of answered.entries()) {
      const values = {
        instruction: stepInstruction(section.title, question.label, input.answers[question.key]),
        modality: "narrative",
        narrativeCriterion: `Record the observed condition, controlling source, reviewer, date, and any deviation from “${input.answers[question.key]}”.`,
        required: Boolean(question.required),
        reviewState: "proposed" as const,
        reviewNote: "Generated from finalized Site Analysis; not yet engineer accepted.",
        updatedAt: new Date(),
      };
      let step = existingSteps.find(
        (step) => Number(step.sequenceNumber) === questionIndex + 1,
      );
      if (step) {
        [step] = await db.update(cxChecklistSteps).set(values).where(eq(cxChecklistSteps.id, step.id)).returning();
      } else {
        [step] = await db.insert(cxChecklistSteps).values({
          checklistId: checklist.id,
          sequenceNumber: String(questionIndex + 1),
          ...values,
        }).returning();
      }
      const citationValues = {
        clauseReference: `Site Analysis / ${section.title} / ${question.label}`.slice(0, 200),
        sourceRegionId: region.id,
        verificationStatus: "verified",
        verificationReason: "Exact user-confirmed planning input in the versioned Site Analysis basis; engineering acceptance remains separate.",
        updatedAt: new Date(),
      };
      const citation = existingCitations.find((item) => item.stepId === step.id);
      if (citation)
        await db.update(cxClauseCitations).set(citationValues).where(eq(cxClauseCitations.id, citation.id));
      else
        await db.insert(cxClauseCitations).values({
          checklistId: checklist.id,
          stepId: step.id,
          ...citationValues,
        });
    }
  }

  return {
    documentId: document.id,
    documentVersionId: version.id,
    sourceRegionId: region.id,
    systemCount,
    assetCount,
    checklistCount,
    taskCount,
  };
}

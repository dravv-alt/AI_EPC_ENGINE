import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { aggregateVerdicts } from "@/lib/cx/acceptance";
import { analyzeGaugePhoto } from "@/lib/cx/vision";
import { db } from "@/lib/db/client";
import { cxChecklistSteps, cxChecklists, cxStepResults, cxTestRecords, evidence, projects, storageObjects } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";
import { detectAllowedCaptureMediaType } from "@/lib/storage/magic";
import { objectStorage } from "@/lib/storage/service";

/**
 * POST /api/projects/[projectId]/cx/checklists/[checklistId]/steps/[stepId]/vision-reading
 *
 * Phase 5: local Ollama Vision endpoint for field engineers.
 *
 * Accepts a multipart/form-data upload with:
 *   - `photo`: The image file (JPEG, PNG, or WebP) of the field instrument.
 *   - `context` (optional): Free-text context to help the model (e.g. step instruction).
 *
 * Flow:
 *   1. Validates project membership and checklist state.
 *   2. Sends the image to the bounded local Ollama model via `analyzeGaugePhoto`.
 *   3. Stores the result as a `cx_step_result` with verdict = `needs_human_review`.
 *   4. Returns the AI's extracted reading + the advisory structured result.
 *
 * The field engineer MUST review the result and submit a confirmed reading via
 * the normal `/reading` route before it can enter an approved test record.
 * This endpoint NEVER auto-approves or certifies any reading.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"] as const);

type AllowedMime = "image/jpeg" | "image/png" | "image/webp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; checklistId: string; stepId: string }> }
) {
  const { projectId, checklistId, stepId } = await params;

  try {
    const actor = await requireProjectPermission(projectId, "evidence:capture");
    const rateLimited = await enforceAiRateLimit(`vision:${projectId}:${actor.userId}`);
    if (rateLimited) return rateLimited;

    const [checklist, step] = await Promise.all([
      db.query.cxChecklists.findFirst({ where: and(eq(cxChecklists.id, checklistId), eq(cxChecklists.projectId, projectId)) }),
      db.query.cxChecklistSteps.findFirst({ where: and(eq(cxChecklistSteps.id, stepId), eq(cxChecklistSteps.checklistId, checklistId)) }),
    ]);

    if (!checklist || !step) {
      return NextResponse.json({ error: "Checklist step not found." }, { status: 404 });
    }
    if (checklist.status !== "accepted") {
      return NextResponse.json({ error: "An engineer must accept the draft checklist before execution." }, { status: 409 });
    }
    if (step.reviewState !== "accepted") {
      return NextResponse.json({ error: "Only an engineer-accepted step can be executed." }, { status: 409 });
    }
    if (step.modality === "boolean") {
      return NextResponse.json({ error: "Vision reading is not supported for boolean steps. Use the standard reading endpoint." }, { status: 400 });
    }

    // Parse multipart form
    const formData = await request.formData();
    const photo = formData.get("photo");
    const context = formData.get("context")?.toString();

    if (!(photo instanceof File)) {
      return NextResponse.json({ error: "A photo file is required in the 'photo' field." }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(photo.type as AllowedMime)) {
      return NextResponse.json({ error: `Unsupported image type '${photo.type}'. Use JPEG, PNG, or WebP.` }, { status: 400 });
    }
    if (photo.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Photo must be 10 MB or smaller." }, { status: 413 });
    }

    const imageBytes = Buffer.from(await photo.arrayBuffer());
    const detectedMediaType = detectAllowedCaptureMediaType(imageBytes, photo.type);
    if (detectedMediaType !== photo.type) {
      return NextResponse.json({ error: "Photo bytes do not match the declared JPEG, PNG, or WebP media type." }, { status: 415 });
    }

    // Store the immutable input before inference. The storage object and
    // pending evidence record preserve exactly what the advisory model saw,
    // including when the model later times out or returns an invalid result.
    const storedPhoto = await objectStorage.put({
      tenantId: checklist.tenantId,
      projectId,
      bytes: imageBytes,
      mediaType: detectedMediaType,
      fileName: photo.name || "vision-input",
    });
    const photoEvidence = await db.transaction(async (tx) => {
      await tx.insert(storageObjects).values({
        tenantId: checklist.tenantId,
        projectId,
        objectKey: storedPhoto.objectKey,
        mediaType: storedPhoto.mediaType,
        byteSize: storedPhoto.byteSize,
        sha256: storedPhoto.sha256,
        createdBy: actor.userId,
      }).onConflictDoNothing();
      const [object] = await tx.select().from(storageObjects).where(eq(storageObjects.objectKey, storedPhoto.objectKey)).limit(1);
      if (!object) throw new Error("Vision input storage object could not be recorded.");
      const [capture] = await tx.insert(evidence).values({
        projectId,
        systemId: checklist.systemId,
        assetId: checklist.assetId,
        storageObjectId: object.id,
        evidenceType: "photo",
        validityState: "pending",
        contentHash: storedPhoto.sha256,
        clientCaptureId: randomUUID(),
        notes: `Vision advisory input for checklist step ${step.sequenceNumber}; pending engineer review.`,
        capturedBy: actor.userId,
        capturedAt: new Date(),
      }).returning();
      return { capture, object };
    });
    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "cx.step.vision_input.stored",
      entityType: "evidence",
      entityId: photoEvidence.capture.id,
      after: {
        checklistId,
        stepId,
        storageObjectId: photoEvidence.object.id,
        sha256: storedPhoto.sha256,
        mediaType: storedPhoto.mediaType,
        byteSize: storedPhoto.byteSize,
        authority: "pending_review",
      },
    });
    const imageBase64 = imageBytes.toString("base64");
    const stepContext = context ?? step.instruction ?? undefined;

    // The local model call is bounded by the shared Ollama request deadline.
    const analysis = await analyzeGaugePhoto(imageBase64, photo.type as AllowedMime, stepContext);

    // All vision readings enter as needs_human_review regardless of confidence
    const verdict = "needs_human_review" as const;

    // Derive a text reading for the narrative field from the AI's description
    const readingText = [
      analysis.result.rawDescription,
      analysis.result.numericValue !== null
        ? `Extracted value: ${analysis.result.numericValue}${analysis.result.unit ? ` ${analysis.result.unit}` : ""}`
        : null,
      `AI confidence: ${analysis.result.confidence}`,
      analysis.result.extractionFailureReason
        ? `Extraction issue: ${analysis.result.extractionFailureReason}`
        : null,
      `Model: ${analysis.model} (ADVISORY — requires engineer confirmation)`,
      `Vision input evidence: ${photoEvidence.capture.id} (SHA-256: ${storedPhoto.sha256})`,
    ].filter(Boolean).join("\n");

    // Resolve or create the test record for this session
    let record = await db.query.cxTestRecords.findFirst({
      where: and(eq(cxTestRecords.checklistId, checklistId), eq(cxTestRecords.executedBy, actor.userId)),
    });
    if (!record) {
      const project = await db.query.projects.findFirst({ where: (projects, { eq }) => eq(projects.id, projectId) });
      if (!project) throw new Error("Project not found.");
      [record] = await db.insert(cxTestRecords)
        .values({ tenantId: project.tenantId, projectId, checklistId, gateId: checklist.gateId, executedBy: actor.userId })
        .returning();
    }

    // Upsert the step result as needs_human_review with the AI narrative
    const [result] = await db.insert(cxStepResults)
      .values({
        testRecordId: record.id,
        stepId,
        readingValue: analysis.result.numericValue?.toString() ?? null,
        readingBoolean: null,
        readingText,
        enteredBy: actor.userId,
        enteredAt: new Date(),
        verdict,
      })
      .onConflictDoUpdate({
        target: [cxStepResults.testRecordId, cxStepResults.stepId],
        set: {
          readingValue: analysis.result.numericValue?.toString() ?? null,
          readingBoolean: null,
          readingText,
          enteredBy: actor.userId,
          enteredAt: new Date(),
          verdict,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Recompute the overall test record status
    const allResults = await db.select().from(cxStepResults).where(eq(cxStepResults.testRecordId, record.id));
    const overallStatus = aggregateVerdicts(allResults.map((r) => r.verdict));
    await db.update(cxTestRecords).set({ overallStatus, updatedAt: new Date() }).where(eq(cxTestRecords.id, record.id));

    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "cx.step.vision_reading.recorded",
      entityType: "cx_step_result",
      entityId: result.id,
      after: {
        verdict,
        testRecordId: record.id,
        visionModel: analysis.model,
        visionConfidence: analysis.result.confidence,
        visionInputEvidenceId: photoEvidence.capture.id,
        visionInputObjectId: photoEvidence.object.id,
        visionInputSha256: storedPhoto.sha256,
        advisory: true,
      },
    });

    return NextResponse.json({
      stepResult: result,
      testRecordId: record.id,
      verdict,
      overallStatus,
      analysis: {
        numericValue: analysis.result.numericValue,
        unit: analysis.result.unit,
        confidence: analysis.result.confidence,
        rawDescription: analysis.result.rawDescription,
        extractionFailureReason: analysis.result.extractionFailureReason,
        model: analysis.model,
        evidenceId: photoEvidence.capture.id,
        objectId: photoEvidence.object.id,
        sha256: storedPhoto.sha256,
        advisory: true,
      },
      message: "Vision reading recorded as advisory (needs_human_review). A field engineer must confirm this reading using the standard /reading endpoint before it can be approved.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vision analysis failed." },
      { status: error instanceof AccessError ? error.status : 500 }
    );
  }
}

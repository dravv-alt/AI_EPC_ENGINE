import { db } from "@/lib/db/client";
import { teachbackNotes } from "@/lib/db/schema";
import { activeEmbeddingModelTag, getModelProvider } from "@/lib/model/provider";

// Slice 8: generalizes the compliance-only teach-back mechanism
// (compliancePrecedents) to every AI proposal/disposition. Capture happens
// only when a reviewer *edits or rejects* an AI proposal — accepting teaches
// nothing, so callers must never invoke this on a plain accept.
export type TeachbackSubjectType =
  | "requirement"
  | "evidence"
  | "cx_checklist"
  | "schedule_task"
  | "schedule_resource"
  | "schedule_risk"
  | "compliance_check";

// Same transaction-handle shape `deriveFindingOwner` already uses in
// src/lib/compliance/create-check.ts, so capture can run inside the same
// transaction as the review update it is teaching from.
type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export type CaptureTeachbackInput = {
  projectId: string;
  subjectType: TeachbackSubjectType;
  subjectId: string;
  // What the AI proposed, and what the human decided instead. `correctedTo`
  // is null for a rejection — there is no corrected value, only a rationale
  // for why the proposal did not stand.
  correctedFrom: unknown;
  correctedTo: unknown | null;
  rationale: string;
  sourceRegionId?: string | null;
  createdBy: string;
  // The disposition that produced this note. Mirrors reviewState on the
  // subject itself; teach-back notes have no separate approval workflow.
  disposition: "edited" | "rejected";
  // The natural-language text a *future similar proposal* would present —
  // e.g. a requirement's statement, a task's name. This is what gets
  // embedded for later matching, kept separate from `correctedFrom` (a
  // structured snapshot) so surfacing compares like against like: the same
  // kind of free text `surfaceTeachbackAdvisory` embeds its query with.
  embedText: string;
};

export async function captureTeachbackNote(tx: DbTx, input: CaptureTeachbackInput) {
  const provider = getModelProvider();
  const embedding = await provider.embed(input.embedText);
  const [note] = await tx
    .insert(teachbackNotes)
    .values({
      projectId: input.projectId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      correctedFrom: input.correctedFrom as object,
      correctedTo: (input.correctedTo ?? null) as object | null,
      rationale: input.rationale,
      sourceRegionId: input.sourceRegionId ?? null,
      createdBy: input.createdBy,
      reviewState: input.disposition,
      embedding,
      embeddingModel: activeEmbeddingModelTag()
    })
    .returning();
  return note;
}

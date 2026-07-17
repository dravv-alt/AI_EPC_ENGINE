import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { cxTestRecords, storageObjects } from "@/lib/db/schema";
import { editableReportSchema } from "@/lib/cx/generation";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { objectStorage } from "@/lib/storage/service";

const editSchema = z.object({ title: z.string().trim().min(3).max(300), executiveSummary: z.string().trim().min(20).max(4000), conclusion: z.string().trim().min(10).max(2000), reason: z.string().trim().min(5).max(2000) });

export async function GET(_: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const report = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, reportId) });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  try {
    await requireProjectPermission(report.projectId, "audit:view");
    const artifact = report.reportArtifactObjectId ? await db.query.storageObjects.findFirst({ where: eq(storageObjects.id, report.reportArtifactObjectId) }) : null;
    return NextResponse.json({ report, label: report.reportStatus === "approved" ? "ENGINEER APPROVED — IMMUTABLE ARTIFACT" : "DRAFT — PENDING ENGINEER REVIEW", artifactUrl: artifact ? await objectStorage.signedReadUrl(artifact.objectKey, 300) : null, artifactHash: artifact?.sha256 ?? null });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load report." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const parsed = editSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Report edits and a review reason are required.", details: parsed.error.flatten() }, { status: 400 });
  const report = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, reportId) });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(report.projectId, "requirement:review");
    if (report.reportStatus === "approved") return NextResponse.json({ error: "Approved reports are immutable." }, { status: 409 });
    const content = editableReportSchema.safeParse(report.reportContent);
    if (!content.success || report.reportGenerationStatus !== "completed") return NextResponse.json({ error: "A completed generated draft is required before editing." }, { status: 409 });
    const edited = editableReportSchema.parse({ ...content.data, title: parsed.data.title, executiveSummary: parsed.data.executiveSummary, conclusion: parsed.data.conclusion });
    const [updated] = await db.update(cxTestRecords).set({ reportContent: edited, reportReviewNote: parsed.data.reason, updatedAt: new Date() }).where(eq(cxTestRecords.id, report.id)).returning();
    await writeAuditEvent({ projectId: report.projectId, actorId: actor.userId, action: "cx.report.edited", entityType: "cx_test_record", entityId: report.id, before: { title: content.data.title, executiveSummary: content.data.executiveSummary, conclusion: content.data.conclusion }, after: { title: edited.title, executiveSummary: edited.executiveSummary, conclusion: edited.conclusion, reason: parsed.data.reason } });
    return NextResponse.json({ report: updated, label: "DRAFT — PENDING ENGINEER REVIEW" });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to edit report." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

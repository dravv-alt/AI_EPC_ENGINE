import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { cxTestRecords } from "@/lib/db/schema";
import { generateCxReport } from "@/lib/cx/generation";
import { enqueueDurableJob } from "@/lib/jobs/queue";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function POST(_: Request, { params }: { params: Promise<{ testRecordId: string }> }) {
  const { testRecordId } = await params;
  const record = await db.query.cxTestRecords.findFirst({ where: eq(cxTestRecords.id, testRecordId) });
  if (!record) return NextResponse.json({ error: "Test record not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(record.projectId, "evidence:capture");
    if (record.reportStatus === "approved") return NextResponse.json({ error: "Approved reports are immutable." }, { status: 409 });
    if (record.reportGenerationStatus === "completed" && record.reportContent) return NextResponse.json({ reportJobId: record.reportGenerationJobId, status: "completed", reportId: record.id, duplicate: true });
    const queued = await enqueueDurableJob({ queue: "core", name: "cx.report.generate", tenantId: record.tenantId, projectId: record.projectId, idempotencyKey: `cx-report-generate:${record.id}`, payload: { testRecordId: record.id, actorId: actor.userId } });
    await db.update(cxTestRecords).set({ reportGenerationJobId: queued.job.id, reportGenerationStatus: queued.queuedInRedis ? "queued" : "running", reportGenerationError: null, updatedAt: new Date() }).where(eq(cxTestRecords.id, record.id));
    if (queued.queuedInRedis) return NextResponse.json({ reportJobId: queued.job.id, reportId: record.id, status: "queued" }, { status: 202 });
    const result = await generateCxReport(record.id, actor.userId);
    return NextResponse.json({ reportJobId: queued.job.id, reportId: record.id, status: "completed", result, infrastructure: "inline-degraded" }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to draft report." }, { status: error instanceof AccessError ? error.status : 409 }); }
}

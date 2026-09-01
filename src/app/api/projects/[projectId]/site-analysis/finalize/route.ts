import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAuditEventInTransaction } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { siteAnalyses } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";
import { enforceUploadRateLimit } from "@/lib/redis/rate-limit";
import { finalizeSiteAnalysis } from "@/lib/site-analysis/finalize";
import { siteSections, type SiteAnswerMap } from "@/lib/site-analysis/questions";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
    // Materialization writes an object, a document revision, and a full set of
    // systems/assets/gates/checklists/tasks. It belongs to the upload category
    // rather than relying only on the blanket per-IP budget in proxy.ts.
    const limited = await enforceUploadRateLimit(`site-analysis-finalize:${projectId}:${actor.userId}`);
    if (limited) return limited;
    const analysis = await db.query.siteAnalyses.findFirst({
      where: eq(siteAnalyses.projectId, projectId),
    });
    if (!analysis)
      return NextResponse.json({ error: "Save Site Analysis before finalizing it." }, { status: 409 });
    const answers = analysis.answers as SiteAnswerMap;
    const missingRequired = siteSections.flatMap((section) =>
      section.questions
        .filter((question) => question.required && !answers[question.key]?.trim())
        .map((question) => question.label),
    );
    if (missingRequired.length)
      return NextResponse.json(
        { error: "Required Site Analysis decisions remain open.", missingRequired },
        { status: 409 },
      );
    const result = await finalizeSiteAnalysis({
      projectId,
      actorId: actor.userId,
      analysisId: analysis.id,
      answers,
    });
    // The status flip and its audit event must commit together: a
    // "finalized" analysis with no chain entry, or an entry with no status
    // change, breaks the traceability the finalize step exists to create.
    // finalizeSiteAnalysis itself is idempotent, so a retry after a failure
    // here re-materializes onto the same rows rather than duplicating them.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(siteAnalyses)
        .set({ status: "finalized", updatedAt: new Date() })
        .where(eq(siteAnalyses.id, analysis.id))
        .returning();
      await writeAuditEventInTransaction(tx, {
        projectId,
        actorId: actor.userId,
        action: "site_analysis.finalized_and_materialized",
        entityType: "site_analysis",
        entityId: analysis.id,
        after: result,
      });
      return row;
    });
    const readiness = await persistProjectGateReadiness(projectId);
    return NextResponse.json({ analysis: updated, handoff: result, readiness });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to finalize Site Analysis." },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { siteAnalyses } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { persistProjectGateReadiness } from "@/lib/readiness/project-readiness";
import { finalizeSiteAnalysis } from "@/lib/site-analysis/finalize";
import { siteSections, type SiteAnswerMap } from "@/lib/site-analysis/questions";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  try {
    const actor = await requireProjectPermission(projectId, "configuration:manage");
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
    const [updated] = await db
      .update(siteAnalyses)
      .set({ status: "finalized", updatedAt: new Date() })
      .where(eq(siteAnalyses.id, analysis.id))
      .returning();
    const readiness = await persistProjectGateReadiness(projectId);
    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "site_analysis.finalized_and_materialized",
      entityType: "site_analysis",
      entityId: analysis.id,
      after: result,
    });
    return NextResponse.json({ analysis: updated, handoff: result, readiness });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to finalize Site Analysis." },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}

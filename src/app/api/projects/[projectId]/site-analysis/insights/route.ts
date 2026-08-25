import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { siteAnalyses, siteAnalysisSnapshots } from "@/lib/db/schema";
import {
  interpretSiteAnalysis,
  siteAnalysisInputHash,
} from "@/lib/site-analysis/interpretation";
import { siteSections } from "@/lib/site-analysis/questions";
import { getGenerationProvider } from "@/lib/model/provider";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceAiRateLimit } from "@/lib/redis/rate-limit";

const requestSchema = z.object({ includeAi: z.boolean().default(true) });
const aiSchema = z.object({
  executiveSummary: z.string().min(30).max(900),
  decisions: z.array(z.string().min(8).max(280)).max(5),
  caveat: z.string().min(15).max(280),
});

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const snapshots = await db
      .select()
      .from(siteAnalysisSnapshots)
      .where(eq(siteAnalysisSnapshots.projectId, projectId))
      .orderBy(desc(siteAnalysisSnapshots.version))
      .limit(12);
    return NextResponse.json({ snapshots });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load planning insights.",
      },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Insight request is invalid." },
      { status: 400 },
    );
  try {
    const actor = await requireProjectPermission(projectId, "audit:view");
    const analysis = await db.query.siteAnalyses.findFirst({
      where: eq(siteAnalyses.projectId, projectId),
    });
    if (!analysis)
      return NextResponse.json(
        { error: "Save Site Analysis before generating Planning Insights." },
        { status: 409 },
      );
    const answers = analysis.answers as Record<string, string>;
    const completed = analysis.completedSections as string[];
    const interpretation = interpretSiteAnalysis(
      answers,
      completed.length,
      siteSections.length,
    );
    const previous = await db
      .select({
        version: siteAnalysisSnapshots.version,
        inputsHash: siteAnalysisSnapshots.inputsHash,
      })
      .from(siteAnalysisSnapshots)
      .where(eq(siteAnalysisSnapshots.siteAnalysisId, analysis.id))
      .orderBy(desc(siteAnalysisSnapshots.version))
      .limit(1);
    const inputsHash = siteAnalysisInputHash(answers);
    if (previous[0]?.inputsHash === inputsHash) {
      const existing = await db
        .select()
        .from(siteAnalysisSnapshots)
        .where(eq(siteAnalysisSnapshots.siteAnalysisId, analysis.id))
        .orderBy(desc(siteAnalysisSnapshots.version))
        .limit(1);
      return NextResponse.json({ snapshot: existing[0], reused: true });
    }

    let aiSummary: z.infer<typeof aiSchema> | null = null;
    if (parsed.data.includeAi) {
      const limited = await enforceAiRateLimit(
        `site-analysis-insights:${projectId}:${actor.userId}`,
      );
      if (limited) return limited;
      const mock = {
        executiveSummary:
          "This is an advisory planning interpretation of the saved Site Analysis. It highlights deterministic capacity, thermal, and evidence gaps; it does not certify the site, equipment, schedule, or vendor performance.",
        decisions: interpretation.recommendations
          .slice(0, 4)
          .map((item) => item.title),
        caveat:
          "Use controlled documents and qualified engineering review before design release, procurement, or commitments.",
      };
      const generated = await getGenerationProvider().generateStructured({
        system:
          "You are a conservative AI data-centre planning analyst. Summarize only the supplied deterministic metrics and warnings. Never invent measurements, vendor performance, approvals, weather data, certification, or feasibility conclusions. Output JSON only.",
        prompt: JSON.stringify(interpretation),
        schema: aiSchema,
        mock,
      });
      aiSummary = generated.data;
    }
    const [snapshot] = await db
      .insert(siteAnalysisSnapshots)
      .values({
        projectId,
        siteAnalysisId: analysis.id,
        version: (previous[0]?.version ?? 0) + 1,
        inputsHash,
        metrics: interpretation.metrics,
        warnings: interpretation.warnings,
        recommendations: interpretation.recommendations,
        aiSummary,
        generatedBy: actor.userId,
      })
      .returning();
    await writeAuditEvent({
      projectId,
      actorId: actor.userId,
      action: "site_analysis.insight_snapshot_generated",
      entityType: "site_analysis_snapshot",
      entityId: snapshot.id,
      after: {
        version: snapshot.version,
        warningCount: interpretation.warnings.length,
        aiIncluded: Boolean(aiSummary),
      },
    });
    return NextResponse.json({ snapshot, reused: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate planning insights.",
      },
      { status: error instanceof AccessError ? error.status : 500 },
    );
  }
}

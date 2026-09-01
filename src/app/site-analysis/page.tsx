import { FeatureShell } from "@/components/feature-shell";
import { SiteAnalysisWorkbench } from "@/components/site-analysis-workbench";
import { db } from "@/lib/db/client";
import { siteAnalyses } from "@/lib/db/schema";
import { getProjectShellData } from "@/lib/dashboard-data";
import { getActiveProjectId } from "@/lib/projects/current";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export default async function SiteAnalysisPage() { const projectId = await getActiveProjectId(); const [data, analysis] = await Promise.all([getProjectShellData(projectId), db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.projectId, projectId) })]); if (!data) throw new Error("Project not found"); return <FeatureShell projectName={data.project} eyebrow="Feasibility · planning inputs" title="Site Analysis" description="Describe site, power, cooling, water, and delivery goals. Save a transparent planning basis that can be reviewed alongside controlled project evidence."><SiteAnalysisWorkbench projectId={projectId} initial={analysis ? { answers: analysis.answers as Record<string, string>, completedSections: analysis.completedSections as string[], sourceMetadata: analysis.sourceMetadata as { csvFileName?: string; importedRows?: number; importedAt?: string }, status: analysis.status } : null} /></FeatureShell>; }

import { count, eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { TechnologyDraftStudio } from "@/components/technology-draft-studio";
import { getProjectShellData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { technologyPluginDrafts } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function TechnologyDraftsPage() { const projectId = await getActiveProjectId(); const [data, row] = await Promise.all([getProjectShellData(projectId), db.select({ total: count() }).from(technologyPluginDrafts).where(eq(technologyPluginDrafts.projectId, projectId))]); if (!data) throw new Error("Project not found"); return <FeatureShell projectId={projectId} projectName={data.project} eyebrow="Partner onboarding · internal drafts" title="Technology Draft Studio" description="Use category scaffolds to make evidence-ready vendor drafts. Templates are never production plugins or selectable technology options."><TechnologyDraftStudio projectId={projectId} initialCount={row[0]?.total ?? 0} /></FeatureShell>; }

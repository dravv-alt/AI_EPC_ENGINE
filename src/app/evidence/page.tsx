import { eq } from "drizzle-orm";
import { EvidenceWorkbench } from "@/components/evidence-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { evidence, requirements, systems } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function EvidencePage() { const projectId = await getActiveProjectId(); const [data, records, system, requirement] = await Promise.all([getDashboardData(projectId), db.select().from(evidence).where(eq(evidence.projectId, projectId)), db.query.systems.findFirst({ where: eq(systems.projectId, projectId) }), db.query.requirements.findFirst({ where: (table, { and, eq }) => and(eq(table.projectId, projectId), eq(table.reviewState, "accepted")) })]); if (!data) throw new Error("Project not found"); return <FeatureShell projectName={data.project} eyebrow="Engineering · controlled proof" title="Evidence" description="Capture is never acceptance. Reviewers link immutable evidence only to accepted requirements."><EvidenceWorkbench projectId={projectId} systemId={system?.id} requirementId={requirement?.id} records={records} /></FeatureShell>; }

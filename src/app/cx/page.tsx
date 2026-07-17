import { eq, inArray } from "drizzle-orm";
import { CxWorkbench } from "@/components/cx-workbench";
import { FeatureShell } from "@/components/feature-shell";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { assets, cxChecklistSteps, cxChecklists, cxTestRecords, gates, systems } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function CxPage() { const projectId = await getActiveProjectId(); const [data, items, system, gate, asset] = await Promise.all([getDashboardData(projectId), db.select().from(cxChecklists).where(eq(cxChecklists.projectId, projectId)), db.query.systems.findFirst({ where: eq(systems.projectId, projectId) }), db.query.gates.findFirst({ where: eq(gates.projectId, projectId) }), db.query.assets.findFirst({ where: eq(assets.projectId, projectId) })]); if (!data) throw new Error("Project not found"); const ids = items.map((item) => item.id); const [steps, records] = ids.length ? await Promise.all([db.select().from(cxChecklistSteps).where(inArray(cxChecklistSteps.checklistId, ids)), db.select().from(cxTestRecords).where(eq(cxTestRecords.projectId, projectId))]) : [[], []]; return <FeatureShell projectName={data.project} eyebrow="Commissioning execution" title="Cx tests" description="Generate a cited draft, require engineer acceptance, capture deterministic proposed verdicts, and approve passing reports into evidence."><CxWorkbench projectId={projectId} systemId={system?.id} gateId={gate?.id} assetId={asset?.id} checklists={items} steps={steps} records={records} /></FeatureShell>; }

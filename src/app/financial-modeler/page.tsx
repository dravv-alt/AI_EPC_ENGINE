import { eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { FinancialModeler } from "@/components/financial-modeler";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { financialModels } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
export const dynamic = "force-dynamic";
export default async function FinancialModelerPage() { const projectId = await getActiveProjectId(); const [data, model] = await Promise.all([getDashboardData(projectId), db.query.financialModels.findFirst({ where: eq(financialModels.projectId, projectId) })]); if (!data) throw new Error("Project not found"); return <FeatureShell projectId={projectId} projectName={data.project} eyebrow="Commercial planning · beta" title="Financial Modeler" description="Model project economics with live sensitivity analysis. All persisted assumptions are canonical USD; switch the display to INR when estimating locally."><FinancialModeler projectId={projectId} initialModel={model ?? null} /></FeatureShell>; }

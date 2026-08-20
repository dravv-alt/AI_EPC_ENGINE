import { eq } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { ProjectSettingsPanel } from "@/components/project-settings-panel";
import { verifyAuditChain } from "@/lib/audit/verify-chain";
import { can } from "@/lib/auth/roles";
import { getDashboardData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { projectMembers, projects, users } from "@/lib/db/schema";
import { requireProjectPermission } from "@/lib/projects/access";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const projectId = await getActiveProjectId();
  const actor = await requireProjectPermission(projectId, "audit:view");
  const [data, project, members, verification] = await Promise.all([
    getDashboardData(projectId),
    db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
    db.select({ id: projectMembers.id, userId: users.id, displayName: users.displayName, email: users.email, role: projectMembers.role, createdAt: projectMembers.createdAt }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, projectId)),
    verifyAuditChain(projectId)
  ]);
  if (!data || !project) throw new Error("Project not found");
  return <FeatureShell projectName={data.project} eyebrow="Project controls · audit verification" title="Settings" description="Manage project policy and membership through enforced RBAC, then independently verify the append-only audit chain.">
    <ProjectSettingsPanel project={project} members={members} canManage={can(actor.role, "project:manage")} verification={verification} />
  </FeatureShell>;
}

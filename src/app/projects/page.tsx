import { and, eq, inArray, ne } from "drizzle-orm";
import { FeatureShell } from "@/components/feature-shell";
import { ProjectDirectory } from "@/components/project-directory";
import { getPersistedCurrentUser } from "@/lib/auth/user";
import { getProjectShellData } from "@/lib/dashboard-data";
import { db } from "@/lib/db/client";
import { evidence, findings, gates, projectMembers, projects } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const activeProjectId = await getActiveProjectId();
  const [{ user }, activeData] = await Promise.all([getPersistedCurrentUser(), getProjectShellData(activeProjectId)]);
  if (!activeData) throw new Error("Active project not found");
  const memberships = await db.select({ id: projects.id, name: projects.name, code: projects.code, status: projects.status, timezone: projects.timezone, role: projectMembers.role, updatedAt: projects.updatedAt })
    .from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id)).where(eq(projectMembers.userId, user.id));
  const ids = memberships.map((project) => project.id);
  const [gateRows, issueRows, evidenceRows] = ids.length ? await Promise.all([
    db.select({ projectId: gates.projectId, status: gates.status }).from(gates).where(inArray(gates.projectId, ids)),
    db.select({ projectId: findings.projectId }).from(findings).where(and(inArray(findings.projectId, ids), ne(findings.status, "closed"))),
    db.select({ projectId: evidence.projectId }).from(evidence).where(and(inArray(evidence.projectId, ids), eq(evidence.validityState, "accepted"))),
  ]) : [[], [], []];
  const rows = memberships.map((project) => ({
    ...project,
    updatedAt: project.updatedAt.toISOString(),
    gates: gateRows.filter((gate) => gate.projectId === project.id).length,
    readyGates: gateRows.filter((gate) => gate.projectId === project.id && gate.status === "approved").length,
    openIssues: issueRows.filter((issue) => issue.projectId === project.id).length,
    acceptedEvidence: evidenceRows.filter((item) => item.projectId === project.id).length,
  }));
  return <FeatureShell projectName={activeData.project} eyebrow="Portfolio" title="Projects" description="Select a commissioning project, compare its current health, or create a controlled workspace.">
    <ProjectDirectory projects={rows} activeProjectId={activeProjectId} />
  </FeatureShell>;
}

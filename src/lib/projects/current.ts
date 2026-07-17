import { and, eq } from "drizzle-orm";
import { getCurrentIdentity } from "@/lib/auth/provider";
import { db } from "@/lib/db/client";
import { projectMembers, projects, users } from "@/lib/db/schema";
import { AuthenticationError } from "@/lib/auth/provider";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const activeProjectCookie = "pramana_active_project";

export async function getActiveProjectId() {
  let identity;
  try { identity = await getCurrentIdentity(); }
  catch (error) { if (error instanceof AuthenticationError) redirect("/login"); throw error; }
  const user = await db.query.users.findFirst({
    where: identity.provider === "credentials"
      ? eq(users.id, identity.userId)
      : identity.provider === "clerk"
        ? eq(users.externalAuthId, identity.userId)
        : eq(users.email, identity.email)
  });
  if (!user) throw new Error("Authenticated user is not provisioned.");
  const selected = (await cookies()).get(activeProjectCookie)?.value;
  if (selected) {
    const membership = await db.select({ projectId: projects.id })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projectMembers.userId, user.id), eq(projectMembers.projectId, selected), eq(projects.status, "active")))
      .limit(1);
    if (membership[0]) return membership[0].projectId;
  }
  const [membership] = await db.select({ projectId: projects.id })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(and(eq(projectMembers.userId, user.id), eq(projects.status, "active")))
    .orderBy(projects.createdAt)
    .limit(1);
  if (!membership) throw new Error("No project membership is assigned to this account.");
  return membership.projectId;
}

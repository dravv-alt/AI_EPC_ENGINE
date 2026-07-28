import { and, eq } from "drizzle-orm";
import { AccountProvisioningError, getPersistedCurrentUser } from "@/lib/auth/user";
import { db } from "@/lib/db/client";
import { projectMembers, projects } from "@/lib/db/schema";
import { AuthenticationError } from "@/lib/auth/provider";
import { env } from "@/lib/env";
import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const activeProjectCookie = "pramana_active_project";

export async function getActiveProjectId() {
  let user;
  try { ({ user } = await getPersistedCurrentUser()); }
  catch (error) {
    if (error instanceof AuthenticationError) redirect((env.AUTH_MODE === "clerk" ? "/sign-in" : "/login") as Route);
    if (error instanceof AccountProvisioningError && env.AUTH_MODE === "clerk") redirect("/pending-access" as Route);
    throw error;
  }
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

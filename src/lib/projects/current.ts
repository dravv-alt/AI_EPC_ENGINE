import { eq } from "drizzle-orm";
import { getCurrentIdentity } from "@/lib/auth/provider";
import { db } from "@/lib/db/client";
import { projectMembers, projects, users } from "@/lib/db/schema";
import { developmentProjectId } from "@/lib/demo";
import { AuthenticationError } from "@/lib/auth/provider";
import { redirect } from "next/navigation";

export async function getActiveProjectId() {
  let identity;
  try { identity = await getCurrentIdentity(); }
  catch (error) { if (error instanceof AuthenticationError) redirect("/login"); throw error; }
  if (identity.provider === "development") return developmentProjectId;
  const user = await db.query.users.findFirst({ where: identity.provider === "credentials" ? eq(users.id, identity.userId) : eq(users.externalAuthId, identity.userId) });
  if (!user) throw new Error("Authenticated user is not provisioned.");
  const [membership] = await db.select({ projectId: projects.id }).from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id)).where(eq(projectMembers.userId, user.id)).limit(1);
  if (!membership) throw new Error("No project membership is assigned to this account.");
  return membership.projectId;
}

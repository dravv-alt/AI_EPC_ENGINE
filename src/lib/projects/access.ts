import { and, eq } from "drizzle-orm";
import { can, type Permission, type ProjectRole } from "@/lib/auth/roles";
import { getCurrentIdentity } from "@/lib/auth/provider";
import { db } from "@/lib/db/client";
import { projectMembers, users } from "@/lib/db/schema";

export class AccessError extends Error {
  constructor(message: string, readonly status = 403) {
    super(message);
  }
}

export interface ProjectActor {
  userId: string;
  role: ProjectRole;
}

/** Resolves the authenticated person to a persisted project membership. */
export async function requireProjectPermission(projectId: string, permission: Permission): Promise<ProjectActor> {
  const identity = await getCurrentIdentity();
  const user = await db.query.users.findFirst({
    where: identity.provider === "clerk"
      ? eq(users.externalAuthId, identity.userId)
      : identity.provider === "credentials" ? eq(users.id, identity.userId) : eq(users.email, identity.email)
  });

  if (!user) throw new AccessError("This authenticated user has not been provisioned in Pramana.");

  const membership = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id))
  });

  if (!membership) throw new AccessError("You are not a member of this project.");
  if (!can(membership.role, permission)) throw new AccessError("Your project role cannot perform this action.");

  return { userId: user.id, role: membership.role };
}

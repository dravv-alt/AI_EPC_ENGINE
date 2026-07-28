import { and, eq, isNull } from "drizzle-orm";
import { getCurrentIdentity } from "@/lib/auth/provider";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export class AccountProvisioningError extends Error {}

export async function getPersistedCurrentUser() {
  const identity = await getCurrentIdentity();

  if (identity.provider === "credentials") {
    const user = await db.query.users.findFirst({ where: eq(users.id, identity.userId) });
    if (!user) throw new Error("Authenticated user is not provisioned.");
    return { identity, user };
  }

  if (identity.provider === "development") {
    const user = await db.query.users.findFirst({ where: eq(users.email, identity.email.toLowerCase()) });
    if (!user) throw new Error("Authenticated user is not provisioned.");
    return { identity, user };
  }

  const linked = await db.query.users.findFirst({ where: eq(users.externalAuthId, identity.userId) });
  if (linked) return { identity, user: linked };

  const emailMatch = await db.query.users.findFirst({ where: eq(users.email, identity.email.toLowerCase()) });
  if (!emailMatch) {
    throw new AccountProvisioningError("This Clerk account has not been assigned to a Pramana project.");
  }
  if (emailMatch.externalAuthId && emailMatch.externalAuthId !== identity.userId) {
    throw new AccountProvisioningError("This email is already linked to another identity.");
  }

  const [claimed] = await db.update(users)
    .set({ externalAuthId: identity.userId, updatedAt: new Date() })
    .where(and(eq(users.id, emailMatch.id), isNull(users.externalAuthId)))
    .returning();

  if (claimed) return { identity, user: claimed };
  const concurrentlyLinked = await db.query.users.findFirst({ where: eq(users.externalAuthId, identity.userId) });
  if (!concurrentlyLinked) throw new AccountProvisioningError("Unable to link this Clerk identity safely.");
  return { identity, user: concurrentlyLinked };
}

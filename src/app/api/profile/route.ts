import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentIdentity } from "@/lib/auth/provider";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { authSessions, projectMembers, projects, users } from "@/lib/db/schema";

const patchSchema = z.object({ displayName: z.string().trim().min(2).max(200) });

async function persistedUser() {
  const identity = await getCurrentIdentity();
  const user = await db.query.users.findFirst({ where: identity.provider === "credentials" ? eq(users.id, identity.userId) : eq(users.email, identity.email) });
  if (!user) throw new Error("Authenticated user is not provisioned.");
  return { identity, user };
}

export async function GET() {
  try {
    const { identity, user } = await persistedUser();
    const memberships = await db.select({ projectId: projects.id, projectName: projects.name, projectCode: projects.code, role: projectMembers.role }).from(projectMembers).innerJoin(projects, eq(projectMembers.projectId, projects.id)).where(eq(projectMembers.userId, user.id));
    const [sessions, currentSession] = identity.provider === "credentials" ? await Promise.all([
      db.select({ id: authSessions.id, expiresAt: authSessions.expiresAt, mfaVerifiedAt: authSessions.mfaVerifiedAt, revokedAt: authSessions.revokedAt, userAgent: authSessions.userAgent, ipAddress: authSessions.ipAddress, createdAt: authSessions.createdAt }).from(authSessions).where(eq(authSessions.userId, user.id)).orderBy(desc(authSessions.createdAt)).limit(20),
      getSessionUser()
    ]) : [[], null];
    return NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName, totpEnabled: user.totpEnabled, provider: identity.provider }, memberships, sessions: sessions.map((session) => ({ ...session, current: session.id === currentSession?.sessionId })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load profile." }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Display name is invalid." }, { status: 400 });
  try {
    const { user } = await persistedUser();
    const [updated] = await db.update(users).set({ displayName: parsed.data.displayName, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    return NextResponse.json({ user: { id: updated.id, email: updated.email, displayName: updated.displayName, totpEnabled: updated.totpEnabled } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update profile." }, { status: 401 });
  }
}

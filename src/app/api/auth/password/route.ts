import { compare, hash } from "bcryptjs";
import { and, eq, isNull, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { authSessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";

const schema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/)
});

export async function POST(request: Request) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "Password management is handled by the configured identity provider." }, { status: 409 });
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use at least 12 characters with uppercase, lowercase, and a number." }, { status: 400 });
  const user = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!user?.passwordHash || !(await compare(parsed.data.currentPassword, user.passwordHash))) return NextResponse.json({ error: "Current password is invalid." }, { status: 401 });
  if (await compare(parsed.data.newPassword, user.passwordHash)) return NextResponse.json({ error: "The new password must differ from the current password." }, { status: 400 });
  const passwordHash = await hash(parsed.data.newPassword, 12);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.update(authSessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(authSessions.userId, user.id), ne(authSessions.id, session.sessionId), isNull(authSessions.revokedAt)));
  });
  return NextResponse.json({ changed: true, otherSessionsRevoked: true });
}

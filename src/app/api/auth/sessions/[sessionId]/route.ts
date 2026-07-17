import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSessionUser, revokeCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { authSessions } from "@/lib/db/schema";
import { env } from "@/lib/env";

export async function DELETE(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "Sessions are managed by the configured identity provider." }, { status: 409 });
  const current = await getSessionUser();
  if (!current) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { sessionId } = await params;
  if (sessionId === current.sessionId) {
    await revokeCurrentSession();
    return NextResponse.json({ revoked: true, current: true });
  }
  const [session] = await db.update(authSessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, current.id))).returning({ id: authSessions.id });
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json({ revoked: true, current: false });
}

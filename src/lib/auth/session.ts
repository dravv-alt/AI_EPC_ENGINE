import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authSessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, request: Request, mfaVerified: boolean) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db.insert(authSessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    mfaVerifiedAt: mfaVerified ? new Date() : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 100)
  });
  const cookieStore = await cookies();
  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_BASE_URL.startsWith("https://"),
    path: "/",
    expires: expiresAt
  });
  return expiresAt;
}

export async function getSessionUser() {
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const [row] = await db.select({
    sessionId: authSessions.id,
    expiresAt: authSessions.expiresAt,
    mfaVerifiedAt: authSessions.mfaVerifiedAt,
    id: users.id,
    email: users.email,
    displayName: users.displayName,
    totpEnabled: users.totpEnabled
  }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(and(
    eq(authSessions.tokenHash, hashSessionToken(token)),
    isNull(authSessions.revokedAt),
    gt(authSessions.expiresAt, new Date())
  )).limit(1);
  return row ?? null;
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;
  if (token) await db.update(authSessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(authSessions.tokenHash, hashSessionToken(token)));
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function markCurrentSessionMfaVerified() {
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error("Authentication is required.");
  await db.update(authSessions).set({ mfaVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(authSessions.tokenHash, hashSessionToken(token)));
}

import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/auth/crypto";
import { getSessionUser } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db/client";
import { authSessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";

const schema = z.object({ password: z.string().min(1).max(128), token: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "MFA is managed by the configured identity provider." }, { status: 409 });
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Password and a six-digit authenticator code are required." }, { status: 400 });
  const user = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!user?.passwordHash || !user.totpEnabled || !user.totpSecretCiphertext) return NextResponse.json({ error: "TOTP is not enabled." }, { status: 409 });
  if (!(await compare(parsed.data.password, user.passwordHash)) || !verifyTotp(user.email, decryptSecret(user.totpSecretCiphertext), parsed.data.token)) return NextResponse.json({ error: "Password or authenticator code is invalid." }, { status: 401 });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ totpEnabled: false, totpSecretCiphertext: null, totpPendingSecretCiphertext: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.update(authSessions).set({ mfaVerifiedAt: null, updatedAt: new Date() }).where(eq(authSessions.userId, user.id));
  });
  return NextResponse.json({ totpEnabled: false });
}

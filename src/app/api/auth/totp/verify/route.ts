import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/auth/crypto";
import { getSessionUser, markCurrentSessionMfaVerified } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { enforceAuthRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({ token: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "TOTP verification requires credentials auth mode." }, { status: 409 });
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const limited = await enforceAuthRateLimit(`totp-verify:${sessionUser.id}`);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A six-digit code is required." }, { status: 400 });
  const user = await db.query.users.findFirst({ where: eq(users.id, sessionUser.id) });
  if (!user?.totpPendingSecretCiphertext) return NextResponse.json({ error: "Start enrollment before verifying a code." }, { status: 409 });
  const secret = decryptSecret(user.totpPendingSecretCiphertext);
  if (!verifyTotp(user.email, secret, parsed.data.token)) return NextResponse.json({ error: "Verification code is invalid." }, { status: 400 });
  await db.update(users).set({ totpEnabled: true, totpSecretCiphertext: user.totpPendingSecretCiphertext, totpPendingSecretCiphertext: null, updatedAt: new Date() }).where(eq(users.id, user.id));
  await markCurrentSessionMfaVerified();
  return NextResponse.json({ totpEnabled: true });
}

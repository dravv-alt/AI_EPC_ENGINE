import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { clientIp, enforceAuthRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({ email: z.string().email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(128), totp: z.string().optional() });
const denied = () => NextResponse.json({ error: "Email, password, or verification code is invalid." }, { status: 401 });

export async function POST(request: Request) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "Credentials login is disabled in the active auth mode." }, { status: 409 });
  // Scoped by client IP, never by email, so a rate-limited response cannot be
  // used to probe whether an account exists (Rules.md line 87).
  const limited = await enforceAuthRateLimit(`login:${clientIp(request)}`);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return denied();
  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) return denied();
  if (user.totpEnabled) {
    if (!parsed.data.totp) return NextResponse.json({ mfaRequired: true }, { status: 202 });
    if (!user.totpSecretCiphertext || !verifyTotp(user.email, decryptSecret(user.totpSecretCiphertext), parsed.data.totp)) return denied();
  }
  const expiresAt = await createSession(user.id, request, user.totpEnabled);
  return NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName, totpEnabled: user.totpEnabled }, expiresAt });
}

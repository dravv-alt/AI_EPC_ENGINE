import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret } from "@/lib/auth/crypto";
import { getSessionUser } from "@/lib/auth/session";
import { createTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { enforceAuthRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({ password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "TOTP enrollment requires credentials auth mode." }, { status: 409 });
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const limited = await enforceAuthRateLimit(`totp-enroll:${sessionUser.id}`);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Password is required." }, { status: 400 });
  const user = await db.query.users.findFirst({ where: eq(users.id, sessionUser.id) });
  if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "Password is invalid." }, { status: 401 });
  const totp = createTotp(user.email);
  await db.update(users).set({ totpPendingSecretCiphertext: encryptSecret(totp.secret.base32), updatedAt: new Date() }).where(eq(users.id, user.id));
  return NextResponse.json({ secret: totp.secret.base32, uri: totp.toString(), issuer: "Pramana CX", account: user.email });
}

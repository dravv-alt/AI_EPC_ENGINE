import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptSecret } from "@/lib/auth/crypto";
import { getSessionUser, markCurrentSessionMfaVerified } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { enforceAuthRateLimit } from "@/lib/redis/rate-limit";
const schema = z.object({ token: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) { const session = await getSessionUser(); if (!session) return NextResponse.json({ error: "Authentication is required." }, { status: 401 }); const limited = await enforceAuthRateLimit(`totp-challenge:${session.id}`); if (limited) return limited; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "A six-digit code is required." }, { status: 400 }); const user = await db.query.users.findFirst({ where: eq(users.id, session.id) }); if (!user?.totpEnabled || !user.totpSecretCiphertext) return NextResponse.json({ error: "TOTP is not enabled." }, { status: 409 }); if (!verifyTotp(user.email, decryptSecret(user.totpSecretCiphertext), parsed.data.token)) return NextResponse.json({ error: "Verification code is invalid." }, { status: 400 }); await markCurrentSessionMfaVerified(); return NextResponse.json({ verified: true, validForMinutes: 10 }); }

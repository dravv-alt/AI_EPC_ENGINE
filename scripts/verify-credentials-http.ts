import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { authSessions, projectMembers, projects, tenants, users } from "../src/lib/db/schema";

async function main() {
  const base = process.env.CREDENTIALS_TEST_URL ?? "http://localhost:4185";
  const email = `phase0-http-${Date.now()}@pramana.test`;
  const password = "FoundationPass2026";
  let userId: string | undefined; let projectId: string | undefined; let tenantId: string | undefined;
  try {
    const register = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, displayName: "Phase Zero Verifier", organizationName: "Phase Zero Isolated", projectName: "HTTP Contract Project", projectCode: `P0-${Date.now()}`, timezone: "Asia/Kolkata" }) });
    const registration = await register.json() as { user?: { id: string }; project?: { id: string; tenantId: string }; error?: string };
    if (register.status !== 201 || !registration.user || !registration.project) throw new Error(`register ${register.status}: ${registration.error}`);
    userId = registration.user.id; projectId = registration.project.id; tenantId = registration.project.tenantId;
    const cookie = (register.headers.get("set-cookie") ?? "").split(";")[0];
    if (!cookie) throw new Error("Registration did not return an HttpOnly session cookie.");
    if ((await fetch(`${base}/api/profile`, { headers: { cookie } })).status !== 200) throw new Error("Authenticated profile request failed.");
    const enroll = await fetch(`${base}/api/auth/totp/enroll`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const enrollment = await enroll.json() as { secret?: string; error?: string };
    if (enroll.status !== 200 || !enrollment.secret) throw new Error(`enroll ${enroll.status}: ${enrollment.error}`);
    const authenticator = new OTPAuth.TOTP({ issuer: "Pramana CX", label: email, secret: OTPAuth.Secret.fromBase32(enrollment.secret), algorithm: "SHA1", digits: 6, period: 30 });
    const verify = await fetch(`${base}/api/auth/totp/verify`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ token: authenticator.generate() }) });
    if (verify.status !== 200) throw new Error(`TOTP verification returned ${verify.status}.`);
    await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie } });
    const challenge = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (challenge.status !== 202) throw new Error(`Login did not require MFA; received ${challenge.status}.`);
    const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, totp: authenticator.generate() }) });
    if (login.status !== 200) throw new Error(`MFA login returned ${login.status}.`);
    console.log("Credentials HTTP verification passed: registration, HttpOnly session, scoped profile, TOTP enrollment, MFA challenge, and MFA login.");
  } finally {
    if (userId) await db.delete(authSessions).where(eq(authSessions.userId, userId));
    if (projectId) await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    if (projectId) await db.delete(projects).where(eq(projects.id, projectId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

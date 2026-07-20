import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { projectMembers, projects, tenants, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { createSession } from "@/lib/auth/session";
import { clientIp, enforceAuthRateLimit } from "@/lib/redis/rate-limit";

const schema = z.object({
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/),
  displayName: z.string().trim().min(2).max(200),
  organizationName: z.string().trim().min(2).max(200),
  projectName: z.string().trim().min(2).max(200),
  projectCode: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/),
  timezone: z.string().trim().min(3).max(64).default("Asia/Kolkata")
});

export async function POST(request: Request) {
  if (env.AUTH_MODE !== "credentials") return NextResponse.json({ error: "Credentials registration is disabled in the active auth mode." }, { status: 409 });
  const limited = await enforceAuthRateLimit(`register:${clientIp(request)}`);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Registration data is invalid.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const result = await db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({ name: parsed.data.organizationName }).returning();
      const [user] = await tx.insert(users).values({ email: parsed.data.email, displayName: parsed.data.displayName, passwordHash }).returning();
      const [project] = await tx.insert(projects).values({ tenantId: tenant.id, name: parsed.data.projectName, code: parsed.data.projectCode, timezone: parsed.data.timezone }).returning();
      await tx.insert(projectMembers).values({ projectId: project.id, userId: user.id, role: "admin" });
      return { user, project };
    });
    const expiresAt = await createSession(result.user.id, request, false);
    return NextResponse.json({ user: { id: result.user.id, email: result.user.email, displayName: result.user.displayName }, project: result.project, expiresAt }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("unique") ? "An account or project with these details already exists." : "Unable to register.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireProjectPermission, AccessError } from "@/lib/projects/access";
import { activeProjectCookie } from "@/lib/projects/current";
import { env } from "@/lib/env";

export async function POST(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    (await cookies()).set(activeProjectCookie, projectId, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.APP_BASE_URL.startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
    return NextResponse.json({ activeProjectId: projectId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to activate project." },
      { status: error instanceof AccessError ? error.status : 500 }
    );
  }
}

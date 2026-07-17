import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { scheduleVersions } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params; const version = await db.query.scheduleVersions.findFirst({ where: eq(scheduleVersions.id, versionId) }); if (!version) return NextResponse.json({ error: "Schedule version not found." }, { status: 404 });
  try { await requireProjectPermission(version.projectId, "audit:view"); if (!version.explanation) return NextResponse.json({ error: "AI explanation is still processing or failed; deterministic dates remain valid.", retryable: true }, { status: 409 }); return NextResponse.json({ summary: version.explanation, triggeringEventId: version.triggerEventId, modelVersion: version.explanationModelVersion, generatedAt: version.explanationGeneratedAt, advisory: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load explanation." }, { status: error instanceof AccessError ? error.status : 500 }); }
}

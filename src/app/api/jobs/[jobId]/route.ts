import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { durableJobs } from "@/lib/db/schema";
import { requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await db.query.durableJobs.findFirst({ where: eq(durableJobs.id, jobId) });
  if (!job?.projectId) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  try { await requireProjectPermission(job.projectId, "audit:view"); return NextResponse.json({ job }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load job." }, { status: 403 }); }
}

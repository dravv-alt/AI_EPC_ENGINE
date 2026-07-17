import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cxChecklistSteps, cxChecklists, cxClauseCitations } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function GET(_: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const { checklistId } = await params;
  const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, checklistId) });
  if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  try {
    await requireProjectPermission(checklist.projectId, "audit:view");
    const [steps, citations] = await Promise.all([db.select().from(cxChecklistSteps).where(eq(cxChecklistSteps.checklistId, checklistId)), db.select().from(cxClauseCitations).where(eq(cxClauseCitations.checklistId, checklistId))]);
    return NextResponse.json({ checklist, steps, citations });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load checklist" }, { status: error instanceof AccessError ? error.status : 500 }); }
}

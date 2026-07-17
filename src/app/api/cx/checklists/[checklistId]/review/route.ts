import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cxChecklists } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

export async function POST(_: Request, { params }: { params: Promise<{ checklistId: string }> }) {
  const { checklistId } = await params; const checklist = await db.query.cxChecklists.findFirst({ where: eq(cxChecklists.id, checklistId) });
  if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  try { const actor = await requireProjectPermission(checklist.projectId, "requirement:review"); const [updated] = await db.update(cxChecklists).set({ status: "accepted", reviewedBy: actor.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(cxChecklists.id, checklistId)).returning(); return NextResponse.json({ checklist: updated }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to accept checklist" }, { status: error instanceof AccessError ? error.status : 500 }); }
}

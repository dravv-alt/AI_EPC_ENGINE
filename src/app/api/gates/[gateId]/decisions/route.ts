import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { requireFreshApprovalMfa } from "@/lib/auth/approval";
import { db } from "@/lib/db/client";
import { decisions, edges, evidence, findings, gates, requirements } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { getProjectGateReadiness } from "@/lib/readiness/project-readiness";

const schema = z.object({ decision: z.enum(["approve", "reject", "waive"]), reason: z.string().trim().min(12).max(5000) });
const stableHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function POST(request: Request, { params }: { params: Promise<{ gateId: string }> }) {
  const { gateId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Decision and a substantive reason are required." }, { status: 400 });
  const gate = await db.query.gates.findFirst({ where: eq(gates.id, gateId) }); if (!gate) return NextResponse.json({ error: "Gate not found." }, { status: 404 });
  try {
    const actor = await requireProjectPermission(gate.projectId, "gate:approve"); await requireFreshApprovalMfa();
    if (gate.status === "approved") return NextResponse.json({ error: "This gate already has an approved immutable decision." }, { status: 409 });
    const readiness = (await getProjectGateReadiness(gate.projectId)).find((item) => item.gateId === gate.id); if (!readiness) return NextResponse.json({ error: "Readiness could not be calculated." }, { status: 409 });
    if (parsed.data.decision === "approve" && readiness.state !== "ready") return NextResponse.json({ error: "A gate can only be approved from READY.", readiness }, { status: 409 });
    const gateEdges = await db.select().from(edges).where(and(eq(edges.projectId, gate.projectId), eq(edges.toType, "gate"), eq(edges.toId, gate.id)));
    const requirementIds = gateEdges.filter((edge) => edge.fromType === "requirement" && edge.relationshipType === "AFFECTS").map((edge) => edge.fromId);
    const acceptedRequirements = requirementIds.length ? await db.select().from(requirements).where(and(inArray(requirements.id, requirementIds), eq(requirements.reviewState, "accepted"))) : [];
    const evidenceRows = await db.select().from(evidence).where(eq(evidence.projectId, gate.projectId)); const openFindings = await db.select().from(findings).where(and(eq(findings.gateId, gate.id), eq(findings.status, "open")));
    const baseline = { gateId: gate.id, readiness, requirements: acceptedRequirements.map((item) => ({ id: item.id, sourceRegionId: item.sourceRegionId, updatedAt: item.updatedAt.toISOString() })).sort((a, b) => a.id.localeCompare(b.id)), evidence: evidenceRows.filter((item) => item.validityState === "accepted").map((item) => ({ id: item.id, contentHash: item.contentHash, updatedAt: item.updatedAt.toISOString() })).sort((a, b) => a.id.localeCompare(b.id)), openFindingIds: openFindings.map((item) => item.id).sort() };
    const evidenceBaselineHash = stableHash(baseline); const nextStatus = parsed.data.decision === "reject" ? "blocked" : "approved";
    const [decision] = await db.transaction(async (tx) => { const [decision] = await tx.insert(decisions).values({ projectId: gate.projectId, gateId: gate.id, decidedBy: actor.userId, decision: parsed.data.decision, reason: parsed.data.reason, evidenceBaselineHash, decidedAt: new Date() }).returning(); await tx.update(gates).set({ status: nextStatus, updatedAt: new Date() }).where(eq(gates.id, gate.id)); return [decision]; });
    await writeAuditEvent({ projectId: gate.projectId, actorId: actor.userId, action: `gate.${parsed.data.decision}`, entityType: "decision", entityId: decision.id, before: { gateStatus: gate.status }, after: { gateStatus: nextStatus, evidenceBaselineHash, reason: parsed.data.reason } });
    return NextResponse.json({ decision, gateStatus: nextStatus, baseline, mfaFreshnessMinutes: 10 }, { status: 201 });
  } catch (error) { const status = error instanceof AccessError ? error.status : error instanceof Error && error.message.includes("fresh") || error instanceof Error && error.message.includes("TOTP") ? 428 : 500; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record gate decision." }, { status }); }
}

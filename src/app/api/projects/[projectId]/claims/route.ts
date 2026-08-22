import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { evidence, evidenceClaimLinks, evidenceClaims } from "@/lib/db/schema";
import { claimTypeValues } from "@/lib/evidence/claim-taxonomy";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const createSchema = z.object({
  claimType: z.enum(claimTypeValues),
  metricKey: z.string().trim().min(2).max(120),
  value: z.coerce.number().finite().optional(),
  unit: z.string().trim().max(40).optional(),
  statement: z.string().trim().min(12).max(4000),
  evidenceIds: z.array(z.string().uuid()).min(1).max(25)
});

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const claims = await db.select().from(evidenceClaims).where(eq(evidenceClaims.projectId, projectId)).orderBy(desc(evidenceClaims.createdAt));
    const links = claims.length ? await db.select().from(evidenceClaimLinks).where(inArray(evidenceClaimLinks.claimId, claims.map((claim) => claim.id))) : [];
    return NextResponse.json({ claims: claims.map((claim) => ({ ...claim, evidenceIds: links.filter((link) => link.claimId === claim.id).map((link) => link.evidenceId) })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load evidence claims." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Claim data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "evidence:capture");
    const requestedEvidenceIds = [...new Set(parsed.data.evidenceIds)];
    const evidenceRows = await db.select({ id: evidence.id }).from(evidence).where(and(eq(evidence.projectId, projectId), inArray(evidence.id, requestedEvidenceIds)));
    if (evidenceRows.length !== requestedEvidenceIds.length) {
      return NextResponse.json({ error: "Every linked evidence record must belong to this project." }, { status: 400 });
    }
    const [claim] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(evidenceClaims).values({ projectId, claimType: parsed.data.claimType, metricKey: parsed.data.metricKey, value: parsed.data.value === undefined ? null : String(parsed.data.value), unit: parsed.data.unit || null, statement: parsed.data.statement, status: "proposed", createdBy: actor.userId }).returning();
      await tx.insert(evidenceClaimLinks).values(requestedEvidenceIds.map((evidenceId) => ({ claimId: created.id, evidenceId, relationship: "supports" })));
      return [created];
    });
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "evidence_claim.created", entityType: "evidence_claim", entityId: claim.id, after: { claimType: claim.claimType, metricKey: claim.metricKey, value: claim.value, unit: claim.unit, evidenceIds: requestedEvidenceIds, authority: "proposed_only" } });
    return NextResponse.json({ claim, authority: "proposed_only" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save evidence claim." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { siteAnalyses } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const answerRecord = z.record(z.string().max(80), z.string().max(2000));
const schema = z.object({ answers: answerRecord, completedSections: z.array(z.string().max(60)).max(16), sourceMetadata: z.object({ csvFileName: z.string().max(300).optional(), importedRows: z.number().int().nonnegative().optional(), importedAt: z.string().datetime().optional() }).default({}), status: z.enum(["draft", "review"]).default("draft") });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ analysis: await db.query.siteAnalyses.findFirst({ where: eq(siteAnalyses.projectId, projectId) }) ?? null }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load site analysis." }, { status: error instanceof AccessError ? error.status : 500 }); } }

export async function PUT(request: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Site analysis data is invalid.", issues: parsed.error.flatten() }, { status: 400 }); try { const actor = await requireProjectPermission(projectId, "configuration:manage"); const values = { ...parsed.data, lastSavedBy: actor.userId, updatedAt: new Date() }; const [analysis] = await db.insert(siteAnalyses).values({ projectId, ...values }).onConflictDoUpdate({ target: siteAnalyses.projectId, set: values }).returning(); await writeAuditEvent({ projectId, actorId: actor.userId, action: "site_analysis.saved", entityType: "site_analysis", entityId: analysis.id, after: { status: analysis.status, completedSections: analysis.completedSections, answerCount: Object.keys(parsed.data.answers).length, sourceMetadata: parsed.data.sourceMetadata } }); return NextResponse.json({ analysis }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save site analysis." }, { status: error instanceof AccessError ? error.status : 500 }); } }

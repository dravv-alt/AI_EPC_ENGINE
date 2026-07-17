import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ items: await db.select().from(alerts).where(eq(alerts.projectId, projectId)).orderBy(desc(alerts.createdAt)) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load alerts" }, { status: error instanceof AccessError ? error.status : 500 }); } }

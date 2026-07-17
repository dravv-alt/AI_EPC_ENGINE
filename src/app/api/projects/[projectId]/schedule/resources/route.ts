import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { scheduleResources } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
const schema = z.object({ name: z.string().trim().min(2).max(200), capacity: z.number().int().positive().max(100000), unit: z.string().trim().min(1).max(60).default("crew") });
export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; try { await requireProjectPermission(projectId, "audit:view"); return NextResponse.json({ items: await db.select().from(scheduleResources).where(eq(scheduleResources.projectId, projectId)) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load resources." }, { status: error instanceof AccessError ? error.status : 500 }); } }
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Resource data is invalid." }, { status: 400 }); try { await requireProjectPermission(projectId, "schedule:manage"); const [resource] = await db.insert(scheduleResources).values({ projectId, ...parsed.data }).returning(); return NextResponse.json({ resource }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create resource." }, { status: error instanceof AccessError ? error.status : 409 }); } }

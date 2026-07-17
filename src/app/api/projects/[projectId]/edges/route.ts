import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditEvent } from "@/lib/audit/write-event";
import { db } from "@/lib/db/client";
import { edges } from "@/lib/db/schema";
import { graphEntityExists, graphEntityTypes, graphRelationshipTypes } from "@/lib/graph/entities";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

const schema = z.object({
  fromType: z.enum(graphEntityTypes),
  fromId: z.string().uuid(),
  relationshipType: z.enum(graphRelationshipTypes),
  toType: z.enum(graphEntityTypes),
  toId: z.string().uuid()
}).refine((value) => value.fromId !== value.toId, { message: "Self-referential edges are not allowed." });

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    return NextResponse.json({ items: await db.select().from(edges).where(eq(edges.projectId, projectId)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load graph edges." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Graph edge is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const actor = await requireProjectPermission(projectId, "graph:manage");
    const [fromExists, toExists] = await Promise.all([
      graphEntityExists(projectId, parsed.data.fromType, parsed.data.fromId),
      graphEntityExists(projectId, parsed.data.toType, parsed.data.toId)
    ]);
    if (!fromExists || !toExists) return NextResponse.json({ error: "Both graph entities must exist inside this project." }, { status: 400 });
    const duplicate = await db.query.edges.findFirst({ where: and(
      eq(edges.projectId, projectId),
      eq(edges.fromType, parsed.data.fromType),
      eq(edges.fromId, parsed.data.fromId),
      eq(edges.relationshipType, parsed.data.relationshipType),
      eq(edges.toType, parsed.data.toType),
      eq(edges.toId, parsed.data.toId)
    ) });
    if (duplicate) return NextResponse.json({ edge: duplicate, duplicate: true }, { status: 200 });
    const [edge] = await db.insert(edges).values({ projectId, ...parsed.data }).returning();
    await writeAuditEvent({ projectId, actorId: actor.userId, action: "graph.edge_created", entityType: "edge", entityId: edge.id, after: edge });
    return NextResponse.json({ edge, duplicate: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create graph edge." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

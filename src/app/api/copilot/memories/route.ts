import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getPersistedCurrentUser } from "@/lib/auth/user";
import { forgetMemory } from "@/lib/copilot/memory";
import { db } from "@/lib/db/client";
import { copilotMemories } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

export async function GET() {
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const memories = await db.select({ id: copilotMemories.id, kind: copilotMemories.kind, key: copilotMemories.key, value: copilotMemories.value, updatedAt: copilotMemories.updatedAt })
      .from(copilotMemories).where(and(eq(copilotMemories.projectId, projectId), eq(copilotMemories.userId, user.id)));
    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list memories." }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Memory id is required." }, { status: 400 });
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const [memory] = await db.select({ id: copilotMemories.id }).from(copilotMemories)
      .where(and(eq(copilotMemories.id, id), eq(copilotMemories.projectId, projectId), eq(copilotMemories.userId, user.id))).limit(1);
    if (!memory) return NextResponse.json({ error: "Memory not found." }, { status: 404 });
    await forgetMemory(id, projectId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete memory." }, { status: 401 });
  }
}

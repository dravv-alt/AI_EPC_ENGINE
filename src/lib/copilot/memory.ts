import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { copilotMemories } from "@/lib/db/schema";

export type MemoryInput = { kind: "preference" | "fact"; key: string; value: string };

const MAX_ENTRIES = 20;
const MAX_CHARS = 2000;

export async function recallMemories(projectId: string, userId: string): Promise<string[]> {
  try {
    const rows = await db.select({ kind: copilotMemories.kind, key: copilotMemories.key, value: copilotMemories.value })
      .from(copilotMemories)
      .where(and(eq(copilotMemories.projectId, projectId), eq(copilotMemories.userId, userId)))
      .orderBy(desc(copilotMemories.updatedAt))
      .limit(MAX_ENTRIES);
    const result: string[] = [];
    let chars = 0;
    for (const row of rows) {
      const entry = `[${row.kind}] ${row.key}: ${row.value}`;
      if (chars + entry.length + (result.length ? 1 : 0) > MAX_CHARS) break;
      result.push(entry);
      chars += entry.length + (result.length > 1 ? 1 : 0);
    }
    return result;
  } catch {
    return [];
  }
}

export async function rememberMemory(projectId: string, userId: string, memory: MemoryInput) {
  const [row] = await db.insert(copilotMemories).values({ projectId, userId, ...memory })
    .onConflictDoUpdate({
      target: [copilotMemories.projectId, copilotMemories.userId, copilotMemories.kind, copilotMemories.key],
      set: { value: memory.value, updatedAt: new Date() }
    }).returning();
  return row;
}

export async function forgetMemory(id: string, projectId: string, userId: string) {
  const [row] = await db.delete(copilotMemories)
    .where(and(eq(copilotMemories.id, id), eq(copilotMemories.projectId, projectId), eq(copilotMemories.userId, userId)))
    .returning({ id: copilotMemories.id });
  return row ?? null;
}

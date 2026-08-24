import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/user";
import { db } from "@/lib/db/client";
import { copilotConversations } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";

const createSchema = z.object({ pageContext: z.object({ pathname: z.string().max(500), searchParams: z.record(z.string().optional()) }).optional() });

export async function GET() {
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const conversations = await db.select().from(copilotConversations).where(and(eq(copilotConversations.userId, user.id), eq(copilotConversations.projectId, projectId))).orderBy(desc(copilotConversations.updatedAt));
    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list conversations." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Conversation context is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const [conversation] = await db.insert(copilotConversations).values({ projectId, userId: user.id, lastPageContext: parsed.data.pageContext ?? null }).returning();
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create conversation." }, { status: 401 });
  }
}

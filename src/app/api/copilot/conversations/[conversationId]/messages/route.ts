import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/user";
import { db } from "@/lib/db/client";
import { copilotConversations, copilotMessages, projectMembers } from "@/lib/db/schema";
import { runCopilotTurn } from "@/lib/copilot/loop";
import { getActiveProjectId } from "@/lib/projects/current";
import { clientIp } from "@/lib/redis/rate-limit";

const bodySchema = z.object({ message: z.string().trim().min(1).max(4_000), pageContext: z.object({ pathname: z.string().max(500), searchParams: z.record(z.string().optional()) }) });
const pageSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) });

async function ownedConversation(conversationId: string, userId: string, projectId: string) {
  const conversation = await db.query.copilotConversations.findFirst({ where: eq(copilotConversations.id, conversationId) });
  if (!conversation) return { error: "Conversation not found.", status: 404 } as const;
  if (conversation.userId !== userId || conversation.projectId !== projectId) return { error: "This conversation is outside your active project.", status: 403 } as const;
  return { conversation } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const parsed = pageSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Pagination is invalid." }, { status: 400 });
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const ownership = await ownedConversation(conversationId, user.id, projectId);
    if ("error" in ownership) return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    const messages = await db.select().from(copilotMessages).where(eq(copilotMessages.conversationId, conversationId)).orderBy(asc(copilotMessages.createdAt)).limit(parsed.data.limit).offset(parsed.data.offset);
    return NextResponse.json({ messages, limit: parsed.data.limit, offset: parsed.data.offset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load messages." }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Message data is invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const ownership = await ownedConversation(conversationId, user.id, projectId);
    if ("error" in ownership) return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    const membership = await db.query.projectMembers.findFirst({ where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)) });
    if (!membership) return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    await db.transaction(async (tx) => {
      await tx.insert(copilotMessages).values({ conversationId, role: "user", content: parsed.data.message });
      await tx.update(copilotConversations).set({ lastPageContext: parsed.data.pageContext, updatedAt: new Date() }).where(eq(copilotConversations.id, conversationId));
    });
    const response = await runCopilotTurn({ conversationId, userMessage: parsed.data.message, ctx: { projectId, userId: user.id, role: membership.role, conversationId, cookieHeader: request.headers.get("cookie") ?? "", clientIp: clientIp(request), pathname: parsed.data.pageContext.pathname, searchParams: parsed.data.pageContext.searchParams } });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process copilot message." }, { status: 500 });
  }
}

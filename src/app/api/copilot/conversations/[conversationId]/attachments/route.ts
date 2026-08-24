import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersistedCurrentUser } from "@/lib/auth/user";
import { db } from "@/lib/db/client";
import { copilotAttachments, copilotConversations, documentVersions, documents, projects, storageObjects } from "@/lib/db/schema";
import { getActiveProjectId } from "@/lib/projects/current";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { detectAllowedCaptureMediaType } from "@/lib/storage/magic";
import { resolveUploadDestination } from "@/lib/copilot/routing";
import { env } from "@/lib/env";

export const runtime = "nodejs";
const maxBytes = 20 * 1024 * 1024;
const contextSchema = z.object({ message: z.string().max(4_000).default(""), pathname: z.string().max(500).default("/") });

async function assertConversation(conversationId: string, userId: string, projectId: string) {
  const conversation = await db.query.copilotConversations.findFirst({ where: eq(copilotConversations.id, conversationId) });
  if (!conversation) return { error: "Conversation not found.", status: 404 } as const;
  if (conversation.userId !== userId || conversation.projectId !== projectId) return { error: "This conversation is outside your active project.", status: 403 } as const;
  return { conversation } as const;
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  try {
    const [{ user }, projectId] = await Promise.all([getPersistedCurrentUser(), getActiveProjectId()]);
    const ownership = await assertConversation(conversationId, user.id, projectId);
    if ("error" in ownership) return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    await requireProjectPermission(projectId, "audit:view");

    const form = await request.formData();
    const context = contextSchema.safeParse({ message: form.get("message") ?? "", pathname: form.get("pathname") ?? "/" });
    if (!context.success) return NextResponse.json({ error: "Attachment context is invalid.", issues: context.error.flatten() }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "An attachment file is required." }, { status: 400 });
    if (file.size < 1 || file.size > maxBytes) return NextResponse.json({ error: "Attachments must be between 1 byte and 20 MB." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = detectAllowedCaptureMediaType(bytes, file.type);
    if (!mediaType) return NextResponse.json({ error: "The attachment type or magic bytes are not allowed." }, { status: 415 });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const existing = await db.select({ id: documentVersions.id, title: documents.title }).from(documentVersions).innerJoin(documents, eq(documentVersions.documentId, documents.id)).where(and(eq(documents.projectId, projectId), eq(documentVersions.sha256, sha256))).limit(1);
    const destination = resolveUploadDestination({ message: context.data.message, pathname: context.data.pathname, mediaType, sha256, fileName: file.name, existingDocumentVersion: existing[0] ? { id: existing[0].id, title: existing[0].title } : null });

    if ("destination" in destination && destination.destination === "duplicate") {
      const [attachment] = await db.insert(copilotAttachments).values({ conversationId, originalName: file.name || "attachment", mediaType, byteSize: file.size, sha256, routedTo: "duplicate", routingReason: destination.reason }).returning();
      return NextResponse.json({ attachment, ...destination, uploaded: false });
    }
    if ("needsClarification" in destination) {
      const [attachment] = await db.insert(copilotAttachments).values({ conversationId, originalName: file.name || "attachment", mediaType, byteSize: file.size, sha256, routingReason: "A destination is required before this attachment can be uploaded." }).returning();
      return NextResponse.json({ attachment, ...destination, uploaded: false });
    }

    if (!("destination" in destination)) return NextResponse.json({ error: "Attachment destination could not be resolved." }, { status: 400 });
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const forward = new FormData();
    forward.append("file", new File([bytes], file.name || "attachment", { type: mediaType }));
    if (destination.destination === "source") {
      forward.append("title", String(form.get("title") ?? file.name.replace(/\.[^.]+$/, "")));
      forward.append("revision", String(form.get("revision") ?? "A"));
      forward.append("documentType", String(form.get("documentType") ?? "procedure"));
    } else if (destination.destination === "cx_standard") {
      forward.append("title", String(form.get("title") ?? file.name.replace(/\.[^.]+$/, "")));
      forward.append("revision", String(form.get("revision") ?? "A"));
      forward.append("standardSet", String(form.get("standardSet") ?? "project-standard"));
      forward.append("documentType", String(form.get("documentType") ?? "standard"));
    } else {
      for (const key of ["clientCaptureId", "systemId", "assetId", "evidenceType", "notes", "capturedAt"]) {
        const value = form.get(key);
        if (value !== null) forward.append(key, String(value));
      }
      forward.append("artifact", new File([bytes], file.name || "field-artifact", { type: mediaType }));
    }
    const path = destination.destination === "source" ? `/api/projects/${projectId}/sources` : destination.destination === "cx_standard" ? `/api/projects/${projectId}/cx/standards` : `/api/projects/${projectId}/field-captures`;
    const response = await fetch(`${env.APP_BASE_URL}${path}`, { method: "POST", headers: { cookie: request.headers.get("cookie") ?? "", "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "" }, body: forward });
    const data = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: data?.error ?? "The routed upload failed.", routedTo: destination.destination, details: data }, { status: response.status });
    const stored = await db.query.storageObjects.findFirst({ where: and(eq(storageObjects.projectId, projectId), eq(storageObjects.sha256, sha256)) });
    const routedEntityId = data?.version?.id ?? data?.document?.id ?? data?.evidence?.id ?? null;
    const [attachment] = await db.insert(copilotAttachments).values({ conversationId, storageObjectId: stored?.id ?? null, originalName: file.name || "attachment", mediaType, byteSize: file.size, sha256, routedTo: destination.destination, routedEntityId, routingReason: destination.reason }).returning();
    return NextResponse.json({ attachment, routedTo: destination.destination, routingReason: destination.reason, result: data, uploaded: true }, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process attachment." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

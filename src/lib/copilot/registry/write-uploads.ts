import { z } from "zod";
import { callProjectRoute } from "@/lib/copilot/invoke";
import type { CopilotTool } from "@/lib/copilot/types";
import { evidenceTypeValues } from "@/lib/evidence/taxonomy";

// Binary upload is performed by the attachment endpoint. These registry entries expose the
// corresponding route contracts for the agent catalogue and for metadata-only follow-up calls;
// the drawer sends files through /attachments so the server can validate magic bytes first.
const attachmentRef = z.object({ attachmentId: z.string().uuid() });

export const tools: CopilotTool[] = [
  {
    name: "sources.upload", description: "Route an attachment to the controlled project source corpus; PDF/CSV/XLSX only, extraction remains processing until complete.", permission: "source:upload", rateLimit: "upload", mutating: true,
    input: attachmentRef.extend({ title: z.string().trim().min(3).max(300), revision: z.string().trim().min(1).max(80), documentType: z.string().trim().min(2).max(40).default("procedure") }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/sources` },
    async execute() { return { ok: false, error: "Binary source uploads must be sent through the conversation attachment endpoint." }; }
  },
  {
    name: "sources.add_revision", description: "Add a controlled source revision through the attachment endpoint; extraction remains processing.", permission: "source:upload", rateLimit: "upload", mutating: true,
    input: attachmentRef.extend({ documentId: z.string().uuid(), revision: z.string().trim().min(1).max(80) }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/documents/${a.documentId}/revisions` },
    async execute() { return { ok: false, error: "Binary revisions must be sent through the conversation attachment endpoint." }; }
  },
  {
    name: "cx.upload_standard", description: "Route a PDF attachment to the controlled Cx standards corpus; extraction remains processing.", permission: "source:upload", rateLimit: "upload", mutating: true,
    input: attachmentRef.extend({ title: z.string().trim().min(3).max(300), revision: z.string().trim().min(1).max(80), standardSet: z.string().trim().min(2).max(120), documentType: z.enum(["standard", "procedure"]) }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/cx/standards` },
    async execute() { return { ok: false, error: "Binary Cx standard uploads must be sent through the conversation attachment endpoint." }; }
  },
  {
    name: "evidence.capture", description: "Route an image, PDF, CSV, or text attachment to field capture; it lands pending human review.", permission: "evidence:capture", rateLimit: "upload", mutating: true,
    input: attachmentRef.extend({ clientCaptureId: z.string().uuid(), systemId: z.string().uuid(), assetId: z.string().uuid().optional(), evidenceType: z.enum(evidenceTypeValues).or(z.literal("observation")), notes: z.string().trim().min(2).max(5000), capturedAt: z.string().datetime() }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/field-captures` },
    async execute() { return { ok: false, error: "Binary field captures must be sent through the conversation attachment endpoint." }; }
  },
  {
    name: "evidence.create_record", description: "Create metadata-only evidence through the existing field-capture route; validity remains pending review.", permission: "evidence:capture", rateLimit: "upload", mutating: true,
    input: z.object({ clientCaptureId: z.string().uuid(), systemId: z.string().uuid(), assetId: z.string().uuid().optional(), evidenceType: z.enum(evidenceTypeValues).or(z.literal("observation")), notes: z.string().trim().min(2).max(5000), capturedAt: z.string().datetime() }),
    transport: { kind: "http", method: "POST", path: (a) => `/api/projects/${a.projectId}/field-captures` },
    async execute(ctx, args) { return callProjectRoute(ctx, "POST", (a) => `/api/projects/${a.projectId}/field-captures`, args); }
  }
];

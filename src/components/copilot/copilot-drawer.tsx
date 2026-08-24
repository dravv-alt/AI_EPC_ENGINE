"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { IconButton, PrimaryButton } from "@/components/ui/glass";
import type { CopilotResponseEnvelope } from "@/lib/copilot/types";
import { CopilotMessage } from "./copilot-message";
import { CopilotMemoryPanel } from "./copilot-memory-panel";
import styles from "./copilot.module.css";

export type CopilotPageContext = {
  pathname: string;
  searchParams: Record<string, string | undefined>;
};

type TranscriptEntry =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; envelope: CopilotResponseEnvelope };

/**
 * A clean, honest envelope for the three local (non-backend) failure paths
 * below — no conversation yet, a non-2xx API response, or a network
 * exception. Found live (browser console + a real crash navigating to
 * `/actions?finding=F-1042`): this used to spread a leftover Wave-1 preview
 * fixture (`...fixtureEnvelope`) into these error states, which meant a real
 * error also showed a FABRICATED gate readiness table, a fake citation, and
 * a link to a finding ("F-1042") that has never existed as a real UUID —
 * exactly what §0 rules 6/7 (no uncited claims, render don't generate) exist
 * to prevent, and clicking that fake link 500'd the /actions page. An error
 * state must never carry renders/citations/actions/links that weren't
 * actually produced by a real tool call.
 */
function errorEnvelope(summary: string, detail: string | null): CopilotResponseEnvelope {
  return { summary, detail, citations: [], actions: [], links: [], renders: [], authority: "advisory" };
}

const INITIAL_TRANSCRIPT: TranscriptEntry[] = [];

type StoredMessage = {
  id: string;
  role: string;
  content: string | null;
  citations?: unknown;
  response?: unknown;
};

function isEnvelope(value: unknown): value is CopilotResponseEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CopilotResponseEnvelope>;
  return typeof candidate.summary === "string"
    && Array.isArray(candidate.citations)
    && Array.isArray(candidate.actions)
    && Array.isArray(candidate.links)
    && Array.isArray(candidate.renders)
    && (candidate.authority === "advisory" || candidate.authority === "proposed_only" || candidate.authority === "recorded");
}

function transcriptFromMessages(messages: StoredMessage[]): TranscriptEntry[] {
  const transcript: TranscriptEntry[] = [];
  for (const message of messages) {
    if (message.role === "user" && message.content) {
      transcript.push({ id: message.id, role: "user", text: message.content });
      continue;
    }
    if (message.role !== "assistant" || !message.content) continue;
    const envelope = isEnvelope(message.response)
      ? message.response
      // Records created before full response persistence retain the essential
      // conversational history and citations.
      : { ...errorEnvelope(message.content, null), citations: Array.isArray(message.citations) ? message.citations as CopilotResponseEnvelope["citations"] : [] };
    transcript.push({ id: message.id, role: "assistant", envelope });
  }
  return transcript;
}

async function autoDownload(envelope: CopilotResponseEnvelope) {
  for (const render of envelope.renders) {
    if (render.key !== "download" || !render.data || typeof render.data !== "object") continue;
    const data = render.data as { method?: string; path?: string; body?: unknown; filename?: string };
    if (!data.path) continue;
    try {
      const method = (data.method ?? "GET").toUpperCase();
      const response = await fetch(data.path, { method, headers: method === "GET" ? undefined : { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(data.body ?? {}) });
      if (!response.ok) continue;
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = data.filename ?? "pramana-export";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // The visible Download renderer remains available when browser auto-download is blocked.
    }
  }
}

export function CopilotDrawer({
  onClose,
  conversationId,
  pageContext,
}: {
  conversationId: string | null;
  pageContext: CopilotPageContext;
  onClose: () => void;
}) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(INITIAL_TRANSCRIPT);
  const [draft, setDraft] = useState("");
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [transcript, progressLabel]);

  useEffect(() => {
    if (!conversationId) {
      setTranscript(INITIAL_TRANSCRIPT);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/copilot/conversations/${conversationId}/messages?limit=100`, { signal: controller.signal });
        const body = await response.json().catch(() => null) as { messages?: StoredMessage[] } | null;
        if (response.ok && body?.messages && !controller.signal.aborted) {
          setTranscript(transcriptFromMessages(body.messages));
        }
      } catch (error) {
        if (!controller.signal.aborted) console.warn("[copilot] unable to restore conversation:", error);
      }
    })();
    return () => controller.abort();
  }, [conversationId]);

  async function handleSubmit(event?: React.FormEvent, overrideMessage?: string) {
    event?.preventDefault();
    const message = (overrideMessage ?? draft).trim();
    if (!message) return;
    setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }]);
    setDraft("");

    // One honest label, not a fixed sequence — the actual tool(s) invoked
    // this turn aren't known until the response comes back (D12 — no token
    // streaming), so this must not claim a specific tool ran (found live,
    // Opus consult, 2026-08-24: it always said "running readiness.gates…"
    // regardless of what was actually asked).
    setProgressLabel("checking your project data…");
    if (!conversationId) {
      setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "assistant", envelope: errorEnvelope("Give me just a second to get set up, then try sending that again.", null) }]);
      setProgressLabel(null);
      return;
    }
    try {
      const response = await fetch(`/api/copilot/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pageContext }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) console.warn("[copilot] request failed:", body?.error ?? response.statusText);
      const envelope: CopilotResponseEnvelope = response.ok && body
        ? body as CopilotResponseEnvelope
        : errorEnvelope("I couldn't get that through just now — mind trying again?", null);
      void autoDownload(envelope);
      setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "assistant", envelope }]);
    } catch (error) {
      console.warn("[copilot] network error:", error);
      setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "assistant", envelope: errorEnvelope("I'm having trouble connecting right now — please try again in a moment.", null) }]);
    } finally {
      setProgressLabel(null);
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !conversationId) return;

    setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "user", text: `Attached: ${file.name}` }]);
    setProgressLabel("uploading attachment…");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("message", draft);
      form.append("pathname", pageContext.pathname);
      const response = await fetch(`/api/copilot/conversations/${conversationId}/attachments`, { method: "POST", body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "assistant", envelope: errorEnvelope(body?.error ?? "That attachment didn't go through — mind trying again?", null) }]);
        return;
      }
      const summary = body.uploaded
        ? `Got it — routed "${file.name}" to ${String(body.routedTo).replace(/_/g, " ")}.`
        : body.needsClarification
        ? `I need a bit more detail before I can file "${file.name}" — tell me where it should go.`
        : `"${file.name}" looks like a duplicate of something already on file.`;
      setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "assistant", envelope: errorEnvelope(summary, body.routingReason ?? null) }]);
    } catch (error) {
      console.warn("[copilot] attachment upload error:", error);
      setTranscript((current) => [...current, { id: crypto.randomUUID(), role: "assistant", envelope: errorEnvelope("I'm having trouble uploading that right now — please try again in a moment.", null) }]);
    } finally {
      setProgressLabel(null);
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <section className={styles.drawer} role="dialog" aria-label="Pramana Copilot">
        <header className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>
            <strong>Pramana Copilot</strong>
            <span>Answers from your controlled project data</span>
          </div>
          <IconButton onClick={onClose} aria-label="Close copilot">
            <X size={16} />
          </IconButton>
        </header>

        <div className={styles.transcript}>
          {transcript.map((entry) =>
            entry.role === "user" ? (
              <div className={`${styles.messageCard} ${styles.fromUser}`} key={entry.id}>
                <p>{entry.text}</p>
              </div>
            ) : (
              <CopilotMessage envelope={entry.envelope} onOptionSelect={(option) => handleSubmit(undefined, option)} key={entry.id} />
            ),
          )}
          <div ref={transcriptEndRef} />
        </div>

        <CopilotMemoryPanel />

        {progressLabel && (
          <div className={styles.progress}>
            <span className={styles.progressDot} aria-hidden="true" />
            <span>{progressLabel}</span>
          </div>
        )}

        <form className={styles.composer} onSubmit={handleSubmit}>
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} hidden aria-hidden="true" />
          <IconButton type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach a file">
            <Paperclip size={16} />
          </IconButton>
          <input
            className={styles.composerInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about your project…"
            aria-label="Message Pramana Copilot"
          />
          <PrimaryButton type="submit">Send</PrimaryButton>
        </form>
      </section>
    </>
  );
}

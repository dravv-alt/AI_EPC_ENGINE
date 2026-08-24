import { primaryWorkspaceRouteMetadata } from "@/lib/workspace-routes";

/**
 * Deterministic (harness, zero model cost) shortcut for messages that need
 * no project data and have a fixed correct answer — a full structured-
 * generation round trip for "hi" was pure waste (Opus consult, 2026-08-24).
 *
 * Anchored to the WHOLE trimmed message (never a substring match) — that is
 * the entire safety story here: "hi, what's the gate status" does not
 * match and goes through the model as normal. Only genuinely trivial,
 * data-free turns are short-circuited.
 */
export function matchTrivialIntent(userMessage: string): { summary: string; detail: string | null } | null {
  const trimmed = userMessage.trim().replace(/[!.?\s]+$/, "");

  if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))$/i.test(trimmed)) {
    return { summary: "Hey! What can I help you with on this project?", detail: null };
  }
  if (/^(thanks|thank you|ty|cheers|nice|perfect|great)$/i.test(trimmed)) {
    return { summary: "Anytime — let me know if there's anything else.", detail: null };
  }
  if (/^(what can you do|what do you do|help|who are you|what are you)$/i.test(trimmed)) {
    const pages = primaryWorkspaceRouteMetadata.map((route) => route.label).join(", ");
    return {
      summary: `I can answer questions from your controlled project documents, and check or update things like ${pages} — just ask in plain language.`,
      detail: "For anything I create or change, a person still reviews and approves it before it's final."
    };
  }
  return null;
}

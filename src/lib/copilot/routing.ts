// Deterministic upload-destination routing for the Pramana Copilot (Slice 9).
//
// Pure function module: no I/O, no model calls, no DB queries, no fetch. Everything needed is
// passed in by the caller (the attachment-upload route, A3-2 in Wave 3). See
// ChatbotHarnessPlan.md Slice 9 ("The rule") for the source rule this implements.

/** The three real upload destinations this rule can pick between. */
export type UploadDestination = "source" | "cx_standard" | "field_capture";

/** A single resolved destination, chosen without needing to ask the user. */
export interface ResolvedUploadDestination {
  destination: UploadDestination;
  reason: string;
}

/**
 * The file's sha256 already matches a controlled `documentVersions` row. The caller must not
 * upload anything; it should report the duplicate back to the user instead.
 */
export interface DuplicateUploadDestination {
  destination: "duplicate";
  reason: string;
  existing: { id: string; title: string };
}

/** No single destination could be determined — the caller must ask the user to pick one. */
export interface UploadDestinationClarification {
  needsClarification: true;
  candidates: Array<{ destination: UploadDestination; label: string }>;
}

export type UploadDestinationResult =
  | ResolvedUploadDestination
  | DuplicateUploadDestination
  | UploadDestinationClarification;

export interface ResolveUploadDestinationInput {
  /** The user's chat message accompanying the upload, if any. */
  message: string;
  /** The workspace pathname the attachment was dropped/sent from, e.g. "/sources". */
  pathname: string;
  /** The detected (server-validated) media type of the file, e.g. "application/pdf". */
  mediaType: string;
  /** The file's sha256 hex digest. */
  sha256: string;
  /** The original file name, for the clarification/reason text only. */
  fileName: string;
  /**
   * The caller's own lookup of whether `sha256` already matches an existing `documentVersions`
   * row. This module cannot query the DB itself (it is pure), so the caller must resolve this
   * before calling. `null`/`undefined` means "no match found".
   */
  existingDocumentVersion?: { id: string; title: string } | null;
}

const DESTINATION_LABELS: Record<UploadDestination, string> = {
  source: "Project source",
  cx_standard: "Cx standard",
  field_capture: "Field capture",
};

function candidate(destination: UploadDestination) {
  return { destination, label: DESTINATION_LABELS[destination] };
}

// ---------------------------------------------------------------------------------------------
// Condition: explicit instruction in the message text.
//
// Conservative, keyword-based (no model access). Each destination has its own phrase set; a
// message resolves only if exactly one destination's phrases match — if two destinations' phrase
// sets both match (the message is talking about more than one place), that is treated as
// ambiguous and falls through to the next condition rather than guessing.
// ---------------------------------------------------------------------------------------------

const SOURCE_PHRASES =
  /\b(file (this|it)( as)? as a (project )?source|add (this|it) as a (project )?source|upload (this|it) as a (project )?source|this is a (project )?source|add (this|it) to (the )?sources)\b/i;

const CX_STANDARD_PHRASES =
  /\b(file (this|it) as a (cx |commissioning )?standard|add (this|it) as a (cx |commissioning )?standard|upload (this|it) as a (cx |commissioning )?standard|this is a (cx |commissioning )?standard)\b/i;

const FIELD_CAPTURE_PHRASES =
  /\b(file (this|it) as (a )?(field capture|evidence)|add (this|it) as (a )?(field capture|evidence)|this is a (field capture|evidence photo|site photo|field photo)|capture (this|it) as evidence)\b/i;

function matchExplicitInstruction(message: string): UploadDestination | null {
  const matches: UploadDestination[] = [];
  if (SOURCE_PHRASES.test(message)) matches.push("source");
  if (CX_STANDARD_PHRASES.test(message)) matches.push("cx_standard");
  if (FIELD_CAPTURE_PHRASES.test(message)) matches.push("field_capture");
  return matches.length === 1 ? matches[0] : null;
}

// ---------------------------------------------------------------------------------------------
// Condition: unambiguous pathname.
//
// Mirrors the `routeIsActive` helper in src/components/workspace-navigation.tsx
// (`pathname === href || pathname.startsWith(href + "/")`) so prefix matching stays consistent
// with the rest of the app, without importing that (client) module into this pure/dependency-free
// one.
// ---------------------------------------------------------------------------------------------

function pathMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const PATHNAME_DESTINATIONS: Array<{ href: string; destination: UploadDestination }> = [
  { href: "/sources", destination: "source" },
  { href: "/requirements", destination: "source" },
  { href: "/cx", destination: "cx_standard" },
  { href: "/field-capture", destination: "field_capture" },
  { href: "/evidence", destination: "field_capture" },
];

function matchPathname(pathname: string): UploadDestination | null {
  for (const entry of PATHNAME_DESTINATIONS) {
    if (pathMatches(pathname, entry.href)) return entry.destination;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Condition: media type admits exactly one destination.
//
// Business rule (documented for review — see report):
//   image/* (jpeg, png, webp, ...)                                        -> field_capture
//     (neither /sources nor /cx/standards accept images at all)
//   text/csv, application/csv,
//   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
//   application/vnd.ms-excel (xlsx/xls)                                   -> source
//     (cx standards accept PDF only, so CSV/XLSX can only mean source)
//   application/pdf                                                       -> AMBIGUOUS
//     (both /sources and /cx/standards accept PDF; media type alone
//      cannot disambiguate — requires pathname or explicit instruction)
//   anything else                                                         -> AMBIGUOUS
// ---------------------------------------------------------------------------------------------

const CSV_MEDIA_TYPES = new Set(["text/csv", "application/csv"]);
const XLSX_MEDIA_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

function matchMediaType(mediaType: string): UploadDestination | null {
  if (mediaType.startsWith("image/")) return "field_capture";
  if (CSV_MEDIA_TYPES.has(mediaType) || XLSX_MEDIA_TYPES.has(mediaType)) return "source";
  return null;
}

// ---------------------------------------------------------------------------------------------
// resolveUploadDestination
//
// Evaluation order (two deliberate deviations from the plan's literal 1-2-3-4 list order — see
// the report for the reasoning behind both):
//
//   1. Duplicate check (sha256 match) — runs first, ahead of all four numbered conditions.
//      The plan's own worked example requires this: re-dropping the same file on the same
//      pathname must report "duplicate", not silently re-resolve via the pathname condition.
//   2. Explicit instruction (plan condition 1)
//   3. Media type (plan condition 3) — promoted ahead of pathname. Image media types are a hard
//      constraint ("sources/cx-standards can't accept images at all... media type wins outright
//      for images" per this slice's own done-when criteria), so it must win over a pathname that
//      would otherwise contradict it (e.g. a JPEG dropped on /sources). CSV/XLSX are handled the
//      same way for consistency (cx standards never accept them either). A bare PDF is still
//      ambiguous at this step and falls through.
//   4. Unambiguous pathname (plan condition 2)
// ---------------------------------------------------------------------------------------------

export function resolveUploadDestination(
  input: ResolveUploadDestinationInput,
): UploadDestinationResult {
  const { message, pathname, mediaType, fileName, existingDocumentVersion } = input;

  if (existingDocumentVersion) {
    return {
      destination: "duplicate",
      reason: `"${fileName}" matches an existing controlled document ("${existingDocumentVersion.title}"). It is already controlled — nothing was uploaded.`,
      existing: existingDocumentVersion,
    };
  }

  const explicit = matchExplicitInstruction(message);
  if (explicit) {
    return { destination: explicit, reason: `The message explicitly said where "${fileName}" goes.` };
  }

  const byMediaType = matchMediaType(mediaType);
  if (byMediaType) {
    return { destination: byMediaType, reason: `Media type "${mediaType}" only admits one destination.` };
  }

  const byPath = matchPathname(pathname);
  if (byPath) {
    return { destination: byPath, reason: `Uploaded from ${pathname}, which only accepts one destination.` };
  }

  // Nothing resolved a single destination. Pre-fill the candidates that are still plausible.
  const candidates: UploadDestination[] =
    mediaType === "application/pdf" ? ["source", "cx_standard"] : ["source", "cx_standard", "field_capture"];

  return { needsClarification: true, candidates: candidates.map(candidate) };
}

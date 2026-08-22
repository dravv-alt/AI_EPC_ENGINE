"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { compactHash } from "@/lib/presentation";
import { evidenceTaxonomy } from "@/lib/evidence/taxonomy";
import { ClaimEvidenceMatrix } from "@/components/claim-evidence-matrix";

type SystemOption = { id: string; name: string };
type AssetOption = {
  id: string;
  systemId: string;
  tag: string;
  assetType: string;
};
type RequirementOption = { id: string; statement: string };
type RecordRow = {
  id: string;
  systemId: string;
  systemName: string;
  assetId: string | null;
  assetTag: string | null;
  evidenceType: string;
  validityState: string;
  contentHash: string | null;
  capturedAt: string;
  capturedBy: string;
  linkedRequirementIds: string[];
  aiDescription?: string | null;
  classificationProvider?: string | null;
};
const readable = (value: string) => value.replaceAll("_", " ");

export function EvidenceWorkbench({
  projectId,
  systems,
  assets,
  requirements,
  records,
}: {
  projectId: string;
  systems: SystemOption[];
  assets: AssetOption[];
  requirements: RequirementOption[];
  records: RecordRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [captureSystemId, setCaptureSystemId] = useState(systems[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const [requirementId, setRequirementId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (status === "all" || record.validityState === status) &&
          `${record.evidenceType} ${record.systemName} ${record.assetTag ?? ""} ${record.capturedBy}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [query, records, status],
  );
  const selected =
    records.find((record) => record.id === selectedId) ??
    filtered[0] ??
    records[0];
  const linkedRequirements = selected
    ? requirements.filter((requirement) =>
        selected.linkedRequirementIds.includes(requirement.id),
      )
    : [];
  const stateCount = (state: string) =>
    records.filter((record) => record.validityState === state).length;

  async function capture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!captureSystemId)
      return setMessage("Select an existing system before capture.");
    setBusy(true);
    setMessage("Saving evidence to the active project…");
    try {
      const form = new FormData(formElement);
      const response = await fetch(`/api/projects/${projectId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemId: captureSystemId,
          assetId: form.get("assetId") || undefined,
          evidenceType: form.get("evidenceType"),
          contentHash: form.get("contentHash"),
          capturedAt: new Date().toISOString(),
        }),
      });
      const body = await response.json();
      setMessage(
        response.ok ? "Evidence saved as pending review." : body.error,
      );
      if (response.ok) {
        formElement.reset();
        router.refresh();
      }
    } catch {
      setMessage("Evidence could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function review(decision: "accept" | "reject") {
    if (!selected) return;
    if (decision === "accept" && !requirementId)
      return setMessage(
        "Select the accepted requirement this evidence proves.",
      );
    if (reviewNote.trim().length < 3)
      return setMessage("Add a review note of at least three characters.");
    setBusy(true);
    setMessage(
      `${decision === "accept" ? "Accepting" : "Rejecting"} evidence…`,
    );
    try {
      const response = await fetch(`/api/evidence/${selected.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          requirementIds: decision === "accept" ? [requirementId] : [],
          note: reviewNote,
        }),
      });
      const body = await response.json();
      setMessage(
        response.ok
          ? `Evidence ${decision}ed and audit event written.`
          : body.error,
      );
      if (response.ok) {
        setReviewNote("");
        setRequirementId("");
        router.refresh();
      }
    } catch {
      setMessage("Review could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entity-workbench">
      <section className="db-summary evidence-summary">
        <div>
          <FileCheck2 size={17} />
          <span>
            <small>Total records</small>
            <strong>{records.length}</strong>
          </span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>
            <small>Accepted</small>
            <strong>{stateCount("accepted")}</strong>
          </span>
        </div>
        <div>
          <ShieldCheck size={17} />
          <span>
            <small>Needs action</small>
            <strong>
              {stateCount("pending") +
                stateCount("stale") +
                stateCount("failed") +
                stateCount("rejected")}
            </strong>
          </span>
        </div>
        <p>
          <span className="live-dot" /> Live project records
        </p>
      </section>
      <details className="surface record-composer">
        <summary>
          <span>
            <Plus size={16} /> Capture evidence
          </span>
          <small>Creates a pending database record</small>
        </summary>
        <form
          className="workflow-form evidence-capture-form"
          onSubmit={capture}
          aria-busy={busy}
        >
          <label>
            System
            <select
              value={captureSystemId}
              onChange={(event) => setCaptureSystemId(event.target.value)}
              required
              disabled={busy || !systems.length}
            >
              <option value="">
                {systems.length ? "Select system" : "Create a system first"}
              </option>
              {systems.map((system) => (
                <option value={system.id} key={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asset (optional)
            <select name="assetId" disabled={busy || !captureSystemId}>
              <option value="">System-level evidence</option>
              {assets
                .filter((asset) => asset.systemId === captureSystemId)
                .map((asset) => (
                  <option value={asset.id} key={asset.id}>
                    {asset.tag} · {asset.assetType}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Evidence category
            <select name="evidenceType" required disabled={busy}>
              {evidenceTaxonomy.map((type) => (
                <option value={type.value} key={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            SHA-256 content hash
            <input
              name="contentHash"
              pattern="[a-f0-9]{64}"
              minLength={64}
              maxLength={64}
              required
              disabled={busy}
            />
          </label>
          {!systems.length && (
            <p className="form-message">
              Create a controlled system first; the register never stores
              unlinked evidence.
            </p>
          )}
          <button
            className="button button-primary"
            disabled={busy || !systems.length}
          >
            {busy && <LoaderCircle className="button-spinner" size={16} />}Save
            pending evidence
          </button>
        </form>
      </details>
      <ClaimEvidenceMatrix projectId={projectId} records={records} />
      {message && (
        <p className="surface inline-feedback" role="status">
          {message}
        </p>
      )}
      {!records.length ? (
        <section className="surface empty-state">
          <h2>No evidence records</h2>
          <p>Nothing is synthesized. Capture the first record above.</p>
        </section>
      ) : (
        <section className="surface master-detail evidence-master-detail">
          <aside className="master-list">
            <header>
              <div>
                <p className="eyebrow">Evidence register</p>
                <h2>Records</h2>
              </div>
              <span>{filtered.length}</span>
            </header>
            <div className="record-filters">
              <label className="record-search">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search records"
                />
              </label>
              <select
                aria-label="Filter evidence status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All states</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="stale">Stale</option>
                <option value="failed">Failed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="master-list-scroll">
              {filtered.map((record) => (
                <button
                  type="button"
                  className={record.id === selected?.id ? "is-selected" : ""}
                  key={record.id}
                  onClick={() => setSelectedId(record.id)}
                >
                  <span>
                    <b>{readable(record.evidenceType)}</b>
                    <small>
                      {record.systemName}
                      {record.assetTag ? ` · ${record.assetTag}` : ""}
                    </small>
                    <small>
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                      }).format(new Date(record.capturedAt))}
                    </small>
                  </span>
                  <span
                    className={`status-pill ${record.validityState === "accepted" ? "ready" : ["failed", "rejected"].includes(record.validityState) ? "blocked" : "review"}`}
                  >
                    {readable(record.validityState)}
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </aside>
          {selected && (
            <article className="record-detail evidence-detail">
              <header className="record-detail-header">
                <div>
                  <p className="eyebrow">{readable(selected.evidenceType)}</p>
                  <h2>{selected.assetTag || selected.systemName}</h2>
                </div>
                <span
                  className={`status-pill ${selected.validityState === "accepted" ? "ready" : ["failed", "rejected"].includes(selected.validityState) ? "blocked" : "review"}`}
                >
                  {readable(selected.validityState)}
                </span>
              </header>
              <dl className="record-metadata">
                <div>
                  <dt>System</dt>
                  <dd>{selected.systemName}</dd>
                </div>
                <div>
                  <dt>Asset</dt>
                  <dd>{selected.assetTag || "System-level"}</dd>
                </div>
                <div>
                  <dt>Captured by</dt>
                  <dd>{selected.capturedBy}</dd>
                </div>
                <div>
                  <dt>Captured at</dt>
                  <dd>
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(selected.capturedAt))}
                  </dd>
                </div>
              </dl>
              <section className="record-section">
                <header>
                  <h3>Immutable content reference</h3>
                </header>
                <code title={selected.contentHash ?? undefined}>
                  {selected.contentHash || "No content hash stored"}
                </code>
                <small className="hash-short">
                  Display: {compactHash(selected.contentHash)}
                </small>
              </section>
              <section className="record-section">
                <header>
                  <h3>Linked requirements</h3>
                  <span>{linkedRequirements.length}</span>
                </header>
                {linkedRequirements.length ? (
                  linkedRequirements.map((requirement) => (
                    <p className="linked-requirement" key={requirement.id}>
                      {requirement.statement}
                    </p>
                  ))
                ) : (
                  <p className="empty-copy">
                    No PROVES relationship is stored for this evidence.
                  </p>
                )}
              </section>
              {selected.validityState === "pending" && (
                <section className="record-section review-panel">
                  <header>
                    <h3>Review pending evidence</h3>
                  </header>
                  <label>
                    Accepted requirement
                    <select
                      value={requirementId}
                      onChange={(event) => setRequirementId(event.target.value)}
                    >
                      <option value="">Select what this evidence proves</option>
                      {requirements.map((requirement) => (
                        <option value={requirement.id} key={requirement.id}>
                          {requirement.statement}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Review note
                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="Record the basis for this decision."
                    />
                  </label>
                  <div className="review-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => review("reject")}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy || !requirements.length}
                      onClick={() => review("accept")}
                    >
                      Accept and link
                    </button>
                  </div>
                  {!requirements.length && (
                    <p className="empty-copy">
                      An accepted requirement is required before evidence can be
                      accepted.
                    </p>
                  )}
                </section>
              )}
            </article>
          )}
        </section>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ImpactNode = { id: string; type: string; label: string; state: string; distance: number };

type VersionRow = { id: string; documentId: string; title: string; revision: string; status: string; extractionStatus: string; createdAt: Date | string; hasPrevious: boolean; latestForDocument: boolean };

export function ChangeAssessmentList({ versions }: { versions: VersionRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [impact, setImpact] = useState<ImpactNode[]>([]);
  async function assess(id: string) {
    setMessage("Comparing controlled source regions…");
    setImpact([]);
    const response = await fetch(`/api/document-versions/${id}/assess-change`, { method: "POST" });
    const body = await response.json();
    if (response.ok) {
      setImpact(Array.isArray(body.impact) ? body.impact : []);
      setMessage(`${body.changedRegionIds.length} changed regions invalidate ${body.impact?.length ?? 0} downstream records; ${body.staleEvidenceIds.length} evidence marked stale.`);
      router.refresh();
    } else {
      setMessage(body.error);
    }
  }
  return (
    <div className="workflow-stack">
      {message && <p className="surface workflow-card">{message}</p>}
      {impact.length > 0 && (
        <section className="surface workflow-card" aria-label="Change blast radius">
          <h2>Blast radius · {impact.length} impacted records</h2>
          <ul className="impact-list">
            {[...impact].sort((a, b) => a.distance - b.distance).map((node) => (
              <li className="impact-row" key={`${node.type}-${node.id}`}>
                <span className="source-status">{node.type}</span>
                <span className="impact-label">{node.label}</span>
                <span className="impact-meta">{node.state} · hop {node.distance}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {versions.map((version) => (
        <article className="surface workflow-card" key={version.id}>
          <span className={`source-status ${version.extractionStatus === "completed" ? "processed" : "pending"}`}>{version.status} · {version.extractionStatus}</span>
          <h2>{version.title} · {version.revision}</h2>
          <p>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</p>
          {version.latestForDocument && version.extractionStatus === "completed" && version.hasPrevious && <button className="button button-primary" onClick={() => assess(version.id)}>Assess blast radius</button>}
          {version.latestForDocument && !version.hasPrevious && <div className="version-guidance"><b>First controlled version</b><span>Upload a newer revision of this same source before comparison.</span><Link href="/sources">Upload revision</Link></div>}
        </article>
      ))}
      {!versions.length && <section className="surface empty-state"><h2>No controlled versions</h2><p>Upload a source and a subsequent revision to assess its blast radius.</p><Link className="button button-primary" href="/sources">Open Sources</Link></section>}
    </div>
  );
}

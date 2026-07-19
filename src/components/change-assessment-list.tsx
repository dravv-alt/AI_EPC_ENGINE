"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangeAssessmentList({ versions }: { versions: Array<{ id: string; title: string; revision: string; status: string; extractionStatus: string; createdAt: Date | string }> }) { 
  const router = useRouter(); 
  const [message, setMessage] = useState(""); 
  const [blastRadius, setBlastRadius] = useState<any>(null);

  async function assess(id: string) { 
    setMessage("Comparing controlled source regions…"); 
    setBlastRadius(null);
    const response = await fetch(`/api/document-versions/${id}/assess-change`, { method: "POST" }); 
    const body = await response.json(); 
    
    if (response.ok) {
      setMessage(`Change assessment complete. deterministic: true`); 
      setBlastRadius(body);
      router.refresh(); 
    } else {
      setMessage(body.error);
    }
  } 
  
  return (
    <div className="workflow-stack">
      {message && <p className="surface workflow-card">{message}</p>}
      
      {blastRadius && (
        <div className="surface workflow-card" style={{ border: '1px solid var(--accent-yellow)', background: 'var(--background)' }}>
          <p className="eyebrow" style={{ color: 'var(--accent-yellow)' }}>Blast Radius Impact Report</p>
          <h2>Assessment Complete</h2>
          <div style={{ display: 'grid', gap: '8px', marginTop: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Changed Source Regions:</span>
              <b className="mono">{blastRadius.changedRegionIds?.length || 0}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Affected Requirements:</span>
              <b className="mono">{blastRadius.affectedRequirementIds?.length || 0}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Stale Evidence Records:</span>
              <b className="mono">{blastRadius.staleEvidenceIds?.length || 0}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gates Re-opened:</span>
              <b className="mono">{blastRadius.gateIds?.length || 0}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Impacted Decisions:</span>
              <b className="mono">{blastRadius.impactedDecisionCount || 0}</b>
            </div>
          </div>
          
          {(blastRadius.staleEvidenceIds?.length > 0 || blastRadius.gateIds?.length > 0) && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface-sunken)', borderRadius: '4px' }}>
              <span className="mono clause" style={{ display: "block", marginBottom: "8px", color: 'var(--accent-red)' }}>AUTOMATED ACTIONS TAKEN:</span>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                {blastRadius.staleEvidenceIds?.length > 0 && <li>Marked {blastRadius.staleEvidenceIds.length} evidence records as STALE.</li>}
                {blastRadius.gateIds?.length > 0 && <li>Reverted {blastRadius.gateIds.length} APPROVED gates to IN_REVIEW.</li>}
                {blastRadius.gateIds?.length > 0 && <li>Created new OPEN findings to reassess changes.</li>}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {versions.map((version, index) => (
        <article className="surface workflow-card" key={version.id}>
          <span className={`source-status ${version.extractionStatus === "completed" ? "processed" : "pending"}`}>{version.status} · {version.extractionStatus}</span>
          <h2>{version.title} · {version.revision}</h2>
          <p>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</p>
          
          {index === 0 && version.extractionStatus === "completed" && (
            <button className="button button-primary" onClick={() => assess(version.id)} style={{ marginTop: '12px' }}>
              Assess blast radius
            </button>
          )}
        </article>
      ))}
    </div>
  ); 
}

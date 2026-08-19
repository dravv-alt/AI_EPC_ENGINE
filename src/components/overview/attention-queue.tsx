import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowUpRight } from "lucide-react";
import { RequirementReviewActions } from "@/components/requirement-review-actions";

export function AttentionQueue({ data }: { data: DashboardData }) {
  const items = [];
  
  if (data.proposal) {
    items.push({
      type: "Requirement review",
      id: data.proposal.id,
      title: data.proposal.statement,
      meta: data.proposal.citation,
      severity: "medium",
      isProposal: true,
      proposal: data.proposal
    });
  }
  
  data.actions.forEach(action => {
    items.push({
      type: "Finding",
      id: action.id,
      title: action.title,
      meta: `${action.owner} · Due ${action.due}`,
      severity: action.severity,
      isProposal: false
    });
  });

  const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  items.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));
  const displayItems = items.slice(0, 4);

  return (
    <article className="surface action-card" id="actions" style={{ height: "100%", padding: "18px" }}>
      <div className="section-heading" style={{ marginBottom: "12px" }}>
        <div><p className="eyebrow">Action queue</p><h2 style={{ fontSize: "18px" }}>Needs attention</h2></div>
        <Link className="text-button" href="/actions">View all <ArrowUpRight size={14} /></Link>
      </div>
      
      <div className="action-list">
        {displayItems.length === 0 && <p className="empty-copy">Review queue clear.</p>}
        {displayItems.map((item, i) => (
          <div className="action-row" key={`${item.type}-${item.id}-${i}`} style={{ padding: "10px 0" }}>
            <span className={`severity ${item.severity === "critical" ? "high" : item.severity}`} />
            <div>
              <div style={{ fontSize: "9px", color: "var(--muted)", textTransform: "uppercase", fontFamily: "var(--mono)", marginBottom: "2px" }}>
                {item.type}
              </div>
              <b style={{ fontSize: "12px", lineHeight: 1.25, display: "block" }}>{item.title}</b>
              <small style={{ fontSize: "10px", marginTop: "2px" }}>{item.meta}</small>
              
              {item.isProposal && item.proposal && (
                <div style={{ marginTop: "8px" }}>
                  <RequirementReviewActions 
                    requirement={{ 
                      id: item.proposal.id, 
                      statement: item.proposal.statement, 
                      numericValue: null, 
                      unit: null, 
                      tolerance: null 
                    }} 
                    acceptedTargets={[]} 
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

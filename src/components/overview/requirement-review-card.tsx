import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { BookOpen, ListChecks } from "lucide-react";
import { RequirementReviewActions } from "@/components/requirement-review-actions";

export function RequirementReviewCard({ data }: { data: DashboardData }) {
  const proposal = data.proposal;

  return (
    <article className="surface review-card" id="requirements" style={{ padding: "18px" }}>
      <div className="section-heading" style={{ marginBottom: "12px" }}>
        <div>
          <p className="eyebrow">Requirement review</p>
          <h2 style={{ fontSize: "18px" }}>{proposal ? "One proposal needs you" : "Review queue clear"}</h2>
        </div>
        <span className="review-count" style={{ font: "700 13px var(--mono)", color: "var(--muted)" }}>
          {proposal ? "01" : "00"}
        </span>
      </div>

      {proposal ? (
        <>
          <div className="requirement" style={{ marginBottom: "14px" }}>
            <span className="mono clause" style={{ font: "9px var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
              Proposed requirement
            </span>
            <div className="requirement-statement" style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "8px" }}>
              <ListChecks size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: "2px" }} />
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 500, lineHeight: 1.45, color: "var(--ink)" }}>
                {proposal.statement}
              </p>
            </div>
            <div className="citation" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--muted)", fontStyle: "italic" }}>
              <BookOpen size={14} /> {proposal.citation}
            </div>
          </div>
          <RequirementReviewActions 
            requirement={{ 
              id: proposal.id, 
              statement: proposal.statement, 
              numericValue: null, 
              unit: null, 
              tolerance: null 
            }} 
            acceptedTargets={[]} 
          />
        </>
      ) : (
        <p className="empty-copy" style={{ color: "var(--muted)", fontSize: "12px", margin: 0 }}>
          All extracted requirements have been reviewed.
        </p>
      )}
    </article>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import { ProjectState } from "./overview/project-state";
import { ProjectMetrics } from "./overview/project-metrics";
import { GateProgression } from "./overview/gate-progression";
import { AttentionQueue } from "./overview/attention-queue";
import { RequirementReviewCard } from "./overview/requirement-review-card";
import { ProjectHealth } from "./overview/project-health";
import { RecentActivity } from "./overview/recent-activity";
import { RecentSources } from "./overview/recent-sources";
import { SystemsAndRisks } from "./overview/systems-and-risks";
import { AlertTriangle, Camera, FileSearch, FileUp, FlaskConical, Route } from "lucide-react";

export function DashboardInsights({ data }: { data: DashboardData }) {
  return (
    <div className="overview-container">
      {/* 1. HERO PROJECT STATE */}
      <ProjectState data={data} />

      {/* 2. COMPACT PROJECT METRIC STRIP */}
      <ProjectMetrics data={data} />

      {/* 3. DIRECT CONTROLS / QUICK ACTION BAR */}
      <article className="surface dashboard-quick-actions" style={{ marginBottom: "12px" }}>
        <div>
          <p className="eyebrow">Direct controls</p>
          <h2 style={{ fontSize: "16px", margin: 0 }}>Start controlled work</h2>
        </div>
        <nav aria-label="Dashboard quick actions">
          <Link href="/sources"><FileUp size={16} /><span>Upload source</span></Link>
          <Link href="/field-capture"><Camera size={16} /><span>Capture evidence</span></Link>
          <Link href="/cx"><FlaskConical size={16} /><span>Run Cx test</span></Link>
          <Link href="/shipments"><Route size={16} /><span>Monitor shipment</span></Link>
          <Link href="/knowledge"><FileSearch size={16} /><span>Search knowledge</span></Link>
          <Link href="/actions"><AlertTriangle size={16} /><span>Create finding</span></Link>
        </nav>
      </article>

      {/* 4. DEDICATED REQUIREMENT REVIEW BANNER (IF PROPOSAL PENDING) */}
      {data.proposal && (
        <div style={{ marginBottom: "12px" }}>
          <RequirementReviewCard data={data} />
        </div>
      )}

      {/* 5. MAIN OPERATIONAL ROW (GATE PROGRESSION & NEEDS ATTENTION QUEUE) */}
      <div className="overview-main-row" style={{ marginBottom: "12px" }}>
        <GateProgression data={data} />
        <AttentionQueue data={data} />
      </div>

      {/* 6. PROJECT HEALTH & VISUAL DONUT CHARTS */}
      <div style={{ marginBottom: "12px" }}>
        <ProjectHealth data={data} />
      </div>

      {/* 7. 7-DAY AUDIT SPARKLINE & AUTHORITY TRAIL */}
      <div style={{ marginBottom: "12px" }}>
        <RecentActivity data={data} />
      </div>

      {/* 8. CONTROLLED SOURCES & SYSTEMS & RISKS (BALANCED 2-COLUMN FOOTER) */}
      <div className="overview-footer-row" style={{ marginBottom: "16px" }}>
        <RecentSources data={data} />
        <SystemsAndRisks data={data} />
      </div>
    </div>
  );
}

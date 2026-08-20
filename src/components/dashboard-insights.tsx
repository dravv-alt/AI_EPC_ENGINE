"use client";

import React from "react";
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

export function DashboardInsights({ data }: { data: DashboardData }) {
  return (
    <div className="overview-container">
      {/* 1. HERO PROJECT STATE */}
      <ProjectState data={data} />

      {/* 2. COMPACT PROJECT METRIC STRIP */}
      <ProjectMetrics data={data} />

      <div className="overview-main-row dashboard-priority-row">
        {data.proposal && <RequirementReviewCard data={data} />}
        <AttentionQueue data={data} />
      </div>

      <div className="dashboard-delivery-row">
        <GateProgression data={data} />
      </div>

      <details className="surface dashboard-detail-disclosure">
        <summary><span><b>Operational detail</b><small>Evidence health, delivery pulse, recent authority events, sources and system signals</small></span><span>Show detail</span></summary>
        <div className="dashboard-detail-content">
          <ProjectHealth data={data} />
          <div className="overview-footer-row"><RecentActivity data={data} /><RecentSources data={data} /><SystemsAndRisks data={data} /></div>
        </div>
      </details>
    </div>
  );
}

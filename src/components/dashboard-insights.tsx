"use client";

import React from "react";
import type { DashboardData } from "@/lib/dashboard-data";
import { ProjectState } from "./overview/project-state";
import { ProjectMetrics } from "./overview/project-metrics";
import { GateProgression } from "./overview/gate-progression";
import { AttentionQueue } from "./overview/attention-queue";
import { ProjectHealth } from "./overview/project-health";
import { RecentActivity } from "./overview/recent-activity";
import { RecentSources } from "./overview/recent-sources";

export function DashboardInsights({ data }: { data: DashboardData }) {
  return (
    <div className="overview-container">
      {/* 2. PROJECT STATE */}
      <ProjectState data={data} />

      {/* 3. COMPACT PROJECT METRIC STRIP */}
      <ProjectMetrics data={data} />

      {/* 4. MAIN OPERATIONAL ROW */}
      <div className="overview-main-row">
        <div>
          <GateProgression data={data} />
        </div>
        <div>
          <AttentionQueue data={data} />
        </div>
      </div>

      {/* 5. PROJECT HEALTH ROW */}
      <ProjectHealth data={data} />

      {/* 6. RECENT PROJECT CONTEXT */}
      <div className="overview-footer-row">
        <RecentActivity data={data} />
        <RecentSources data={data} />
      </div>
    </div>
  );
}

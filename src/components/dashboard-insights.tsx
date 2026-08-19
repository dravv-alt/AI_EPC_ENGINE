"use client";

import React from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import { ProjectState } from "./overview/project-state";
import { ProjectMetrics } from "./overview/project-metrics";
import { GateProgression } from "./overview/gate-progression";
import { AttentionQueue } from "./overview/attention-queue";
import { ProjectHealth } from "./overview/project-health";
import { RecentActivity } from "./overview/recent-activity";
import { RecentSources } from "./overview/recent-sources";
import { AlertTriangle, Camera, FileSearch, FileUp, FlaskConical, Route } from "lucide-react";

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

      {/* 7. DIRECT CONTROLS / QUICK ACTIONS */}
      <article className="surface dashboard-quick-actions" style={{ marginBottom: "24px" }}>
        <div>
          <p className="eyebrow">Direct controls</p>
          <h2 style={{ fontSize: "18px" }}>Start controlled work</h2>
        </div>
        <nav aria-label="Dashboard quick actions">
          <Link href="/sources"><FileUp size={17} /><span>Upload source</span></Link>
          <Link href="/field-capture"><Camera size={17} /><span>Capture evidence</span></Link>
          <Link href="/cx"><FlaskConical size={17} /><span>Run Cx test</span></Link>
          <Link href="/shipments"><Route size={17} /><span>Monitor shipment</span></Link>
          <Link href="/knowledge"><FileSearch size={17} /><span>Search knowledge</span></Link>
          <Link href="/actions"><AlertTriangle size={17} /><span>Create finding</span></Link>
        </nav>
      </article>
    </div>
  );
}

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowRight } from "lucide-react";

export function RecentActivity({ data }: { data: DashboardData }) {
  const { activity, recentActivity } = data.insights;
  
  const activityMax = useMemo(() => Math.max(1, ...activity.map((item) => item.value)), [activity]);

  return (
    <article className="surface dashboard-chart dashboard-activity" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "18px" }}>
      <header style={{ marginBottom: "12px" }}>
        <div>
          <p className="eyebrow">Append-only authority</p>
          <h2 style={{ fontSize: "18px" }}>7-day activity</h2>
        </div>
        <Link className="dashboard-inline-link" href="/graph" style={{ marginTop: 0 }}>
          Audit timeline <ArrowRight size={14} />
        </Link>
      </header>

      {/* 7-day spark bars */}
      <div className="dashboard-spark-bars" style={{ height: "110px", marginBottom: "16px" }}>
        {activity.map((item) => (
          <div key={item.label}>
            <i style={{ height: `${Math.max(8, (item.value / activityMax) * 100)}%` }} title={`${item.value} audit events`} />
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", marginTop: "auto" }}>
        <div style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
          Latest Authority Events
        </div>
        {recentActivity.slice(0, 4).map((event) => {
          const date = new Date(event.at);
          const dateStr = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
          const timeStr = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date).toLowerCase();

          return (
            <div className="dashboard-audit-row" key={event.id} style={{ padding: "6px 0" }}>
              <i />
              <div>
                <b style={{ textTransform: "capitalize", fontSize: "11px" }}>{event.action}</b>
                <span style={{ fontSize: "9px" }}>{event.entityType} &middot; {event.actor}</span>
              </div>
              <time style={{ fontSize: "9px", color: "var(--muted)" }}>{dateStr} &middot; {timeStr}</time>
            </div>
          );
        })}
        
        {!recentActivity.length && (
          <p className="empty-copy">No material project activity recorded during the last 7 days.</p>
        )}
      </div>
    </article>
  );
}

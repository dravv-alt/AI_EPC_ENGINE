import React from "react";
import Link from "next/link";
import { DashboardData } from "@/lib/dashboard-data";
import { ArrowUpRight } from "lucide-react";

export function RecentSources({ data }: { data: DashboardData }) {
  if (data.sources.length === 0) {
    return (
      <article className="surface source-card" style={{ height: "100%", padding: "18px" }}>
        <div className="section-heading" style={{ marginBottom: "12px" }}>
          <div><p className="eyebrow">Source library</p><h2 style={{ fontSize: "18px" }}>Recent controlled sources</h2></div>
          <Link className="text-button" href="/sources">Open library <ArrowUpRight size={14} /></Link>
        </div>
        <p className="empty-copy">No controlled sources have been added yet.</p>
      </article>
    );
  }

  return (
    <article className="surface source-card" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "18px" }}>
      <div className="section-heading" style={{ marginBottom: "12px" }}>
        <div><p className="eyebrow">Source library</p><h2 style={{ fontSize: "18px" }}>Recent controlled sources</h2></div>
        <Link className="text-button" href="/sources">Open library <ArrowUpRight size={14} /></Link>
      </div>

      <div className="table-wrap" style={{ flex: 1 }}>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Revision</th>
              <th>Processing</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((source) => (
              <tr key={source.id}>
                <td>
                  {source.firstRegionId ? (
                    <Link className="source-table-link" href={`/sources/regions/${source.firstRegionId}`}>
                      <b>{source.title}</b>
                      <small>{source.detail} · open first citation</small>
                    </Link>
                  ) : (
                    <>
                      <b>{source.title}</b>
                      <small>{source.detail}</small>
                    </>
                  )}
                </td>
                <td><span className="mono">{source.revision}</span></td>
                <td>
                  <span className={`source-status ${source.status === "Processed" ? "processed" : "pending"}`}>
                    {source.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

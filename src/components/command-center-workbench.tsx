"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, AlertTriangle, AlertCircle, Info, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

type Alert = {
  id: string;
  projectId: string;
  eventType: string;
  title: string;
  status: "active" | "cleared";
  payload: Record<string, any>;
  createdAt: string | Date;
};

export function CommandCenterWorkbench({ initialAlerts, projectId }: { initialAlerts: Alert[]; projectId: string }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [statusFilter, setStatusFilter] = useState<"active" | "cleared">("active");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [clearing, setClearing] = useState<string | null>(null);

  const filteredAlerts = alerts.filter(alert => {
    if (alert.status !== statusFilter) return false;
    
    if (severityFilter !== "all") {
      const sev = (alert.payload?.severity as string) || "medium";
      if (sev.toLowerCase() !== severityFilter) return false;
    }
    
    return true;
  });

  const getSeverityIcon = (severity: string = "medium") => {
    switch (severity.toLowerCase()) {
      case "high": return <AlertCircle className="text-red-500" size={18} />;
      case "medium": return <AlertTriangle className="text-amber-500" size={18} />;
      case "low": return <Info className="text-blue-500" size={18} />;
      default: return <Info size={18} />;
    }
  };

  const markCleared = async (alertId: string) => {
    setClearing(alertId);
    try {
      const response = await fetch(`/api/projects/${projectId}/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cleared" })
      });
      
      if (response.ok) {
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, status: "cleared" } : a));
        router.refresh();
      }
    } finally {
      setClearing(null);
    }
  };

  return (
    <div className="workflow-stack">
      <div className="surface" style={{ display: "flex", gap: "16px", padding: "16px", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            className={`button ${statusFilter === "active" ? "button-primary" : ""}`}
            onClick={() => setStatusFilter("active")}
          >
            Active ({alerts.filter(a => a.status === "active").length})
          </button>
          <button 
            className={`button ${statusFilter === "cleared" ? "button-primary" : ""}`}
            onClick={() => setStatusFilter("cleared")}
          >
            Cleared ({alerts.filter(a => a.status === "cleared").length})
          </button>
        </div>
        
        <div style={{ width: "1px", height: "24px", background: "var(--border)", margin: "0 8px" }} />
        
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="mono" style={{ fontSize: "12px", color: "var(--foreground-muted)" }}>SEVERITY:</span>
          <select 
            value={severityFilter} 
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="input"
            style={{ padding: "4px 8px", height: "auto" }}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="workflow-stack" style={{ marginTop: "16px" }}>
        {filteredAlerts.length === 0 ? (
          <div className="surface workflow-card" style={{ textAlign: "center", padding: "32px", color: "var(--foreground-muted)" }}>
            No {statusFilter} alerts matching the current filters.
          </div>
        ) : (
          filteredAlerts.map((item) => {
            const severity = (item.payload?.severity as string) || "medium";
            
            return (
              <article className="surface workflow-card" key={item.id} style={{ display: "flex", gap: "16px" }}>
                <div style={{ paddingTop: "4px" }}>
                  {getSeverityIcon(severity)}
                </div>
                
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                        {item.title}
                        {item.payload?.shipmentId && (
                          <Link href={`/shipments?id=${item.payload.shipmentId}` as any} className="mono clause" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent)" }}>
                            Shipment <ExternalLink size={12} />
                          </Link>
                        )}
                        {item.payload?.gateId && (
                          <Link href={`/readiness?id=${item.payload.gateId}` as any} className="mono clause" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--accent)" }}>
                            Gate <ExternalLink size={12} />
                          </Link>
                        )}
                      </h3>
                      <p style={{ margin: 0, color: "var(--foreground-muted)", fontSize: "14px" }}>
                        {item.eventType.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                      </p>
                    </div>
                    
                    {item.status === "active" && (
                      <button 
                        className="button button-primary"
                        onClick={() => markCleared(item.id)}
                        disabled={clearing === item.id}
                        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px" }}
                      >
                        <CheckCircle size={14} />
                        {clearing === item.id ? "Clearing..." : "Mark Cleared"}
                      </button>
                    )}
                  </div>
                  
                  <div className="mono" style={{ fontSize: "12px", background: "var(--background)", padding: "12px", borderRadius: "4px", overflowX: "auto" }}>
                    {JSON.stringify(item.payload, null, 2)}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: string;
  eventType: string;
  title: string;
  status: "active" | "cleared";
  createdAt: string;
};

export function LiveFeed({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<Alert[]>([]);
  const [lastPolled, setLastPolled] = useState<Date>(new Date());
  
  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/alerts?limit=10`);
        if (response.ok && mounted) {
          const data = await response.json();
          setEvents(data.items || []);
          setLastPolled(new Date());
        }
      } catch (err) {
        console.error("Failed to poll events:", err);
      }
    };
    
    void poll();
    const interval = setInterval(poll, 30_000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [projectId]);

  const getColor = (eventType: string) => {
    if (eventType.includes("risk") || eventType.includes("threat")) return "var(--accent)";
    if (eventType.includes("shipment") || eventType.includes("ais")) return "var(--blue-500)";
    return "var(--foreground-muted)";
  };

  return (
    <section className="surface" style={{ padding: "24px", marginTop: "32px", border: "1px solid var(--border)", borderRadius: "8px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          Live Event Feed
          <span className="live-indicator">
            <span className="pulse"></span> Live
          </span>
        </h3>
        <span style={{ fontSize: "12px", color: "var(--foreground-muted)" }}>
          Last polled: {lastPolled.toLocaleTimeString()}
        </span>
      </header>
      
      <div className="workflow-stack" style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "8px" }}>
        {events.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--foreground-muted)" }}>
            Waiting for events...
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} style={{ display: "flex", gap: "12px", padding: "12px", borderLeft: `3px solid ${getColor(event.eventType)}`, background: "var(--background)", borderRadius: "0 4px 4px 0" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="mono clause" style={{ fontSize: "12px" }}>{event.eventType}</span>
                  <span style={{ fontSize: "12px", color: "var(--foreground-muted)" }}>
                    {new Intl.DateTimeFormat("en-IN", { timeStyle: "medium" }).format(new Date(event.createdAt))}
                  </span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: 500 }}>{event.title}</div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--green-500, #10b981);
          background: rgba(16, 185, 129, 0.1);
          padding: 2px 6px;
          border-radius: 12px;
        }
        .pulse {
          width: 6px;
          height: 6px;
          background-color: var(--green-500, #10b981);
          border-radius: 50%;
          animation: pulse-animation 2s infinite;
        }
        @keyframes pulse-animation {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}} />
    </section>
  );
}

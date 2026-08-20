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
  // Do not render a client-local time during SSR: it is formatted differently
  // by the browser and causes a hydration mismatch on every Command Center visit.
  const [lastPolled, setLastPolled] = useState<Date | null>(null);

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
    <section className="surface live-feed">
      <header className="live-feed-header">
        <h3>
          Live Event Feed
          <span className="live-indicator">
            <span className="pulse"></span> Live
          </span>
        </h3>
        <span>
          Last polled: {lastPolled ? new Intl.DateTimeFormat("en-IN", { timeStyle: "medium" }).format(lastPolled) : "—"}
        </span>
      </header>

      <div className="workflow-stack live-feed-list">
        {events.length === 0 ? (
          <div className="live-feed-empty">
            Waiting for events...
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="live-feed-event" style={{ borderLeftColor: getColor(event.eventType) }}>
              <div>
                <div>
                  <span className="mono clause" style={{ fontSize: "12px" }}>{event.eventType}</span>
                  <span>
                    {new Intl.DateTimeFormat("en-IN", { timeStyle: "medium" }).format(new Date(event.createdAt))}
                  </span>
                </div>
                <div>{event.title}</div>
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

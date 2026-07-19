"use client";

import { useCallback, useEffect, useState } from "react";

// Slice 11: alongside browser connectivity, surface how fresh the automatic poll
// feed is. When a projectId is available we sample the newest live-event
// timestamp and render its age, so the demo shows the streams are actively
// updating (or flags them as stale) rather than only asserting server reachability.
function freshnessLabel(newestAt: number, now: number) {
  const seconds = Math.max(0, Math.round((now - newestAt) / 1000));
  if (seconds < 60) return { text: `Live polls fresh · ${seconds}s ago`, stale: false };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { text: `Live polls ${minutes}m ago`, stale: minutes >= 5 };
  return { text: `Live polls ${Math.round(minutes / 60)}h ago`, stale: true };
}

export function ConnectionStatus({ projectId }: { projectId?: string }) {
  const [online, setOnline] = useState(true);
  const [freshness, setFreshness] = useState<{ text: string; stale: boolean } | null>(null);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const sample = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/schedule/live-events`);
      if (!response.ok) return;
      const body = await response.json();
      const times = (Array.isArray(body.items) ? body.items : []).map((item: { at?: string }) => (item.at ? new Date(item.at).getTime() : Number.NaN)).filter((value: number) => Number.isFinite(value));
      if (!times.length) { setFreshness(null); return; }
      setFreshness(freshnessLabel(Math.max(...times), Date.now()));
    } catch { /* transient error; keep the last known freshness */ }
  }, [projectId]);
  useEffect(() => { if (!projectId) return; sample(); const timer = setInterval(sample, 15_000); return () => clearInterval(timer); }, [projectId, sample]);
  return <span className={`sync-state ${online ? "" : "is-offline"}`}><span />{online ? "Online · server connected" : "Offline · local capture only"}{freshness && <em className={`poll-freshness ${freshness.stale ? "is-stale" : ""}`}>{freshness.text}</em>}</span>;
}

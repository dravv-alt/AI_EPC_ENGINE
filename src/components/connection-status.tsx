"use client";

import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return <span className={`sync-state ${online ? "" : "is-offline"}`}><span />{online ? "Online · server connected" : "Offline · local capture only"}</span>;
}

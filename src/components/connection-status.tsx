"use client";

import { useEffect, useState } from "react";

export function ConnectionStatus({ projectId }: { projectId?: string }) {
  void projectId;
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return <span className="sync-state is-offline"><span />Offline · local capture only</span>;
}

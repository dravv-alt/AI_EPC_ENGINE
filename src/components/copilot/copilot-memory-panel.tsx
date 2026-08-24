"use client";

import { useEffect, useState } from "react";

type Memory = { id: string; kind: string; key: string; value: string };

export function CopilotMemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const response = await fetch("/api/copilot/memories");
    if (response.ok) setMemories((await response.json()).memories ?? []);
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function remove(id: string) {
    const response = await fetch(`/api/copilot/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setMemories((current) => current.filter((memory) => memory.id !== id));
  }

  return (
    <div style={{ padding: "0 16px 10px" }}>
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", fontSize: 12, opacity: 0.75 }}>
        {open ? "Hide memory" : "Manage memory"}
      </button>
      {open && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        {memories.length === 0 ? <small>No saved preferences or facts.</small> : memories.map((memory) => (
          <div key={memory.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
            <span><strong>{memory.key}</strong>: {memory.value}</span>
            <button type="button" onClick={() => void remove(memory.id)} aria-label={`Forget ${memory.key}`} style={{ background: "transparent", border: 0, cursor: "pointer", color: "inherit" }}>×</button>
          </div>
        ))}
      </div>}
    </div>
  );
}

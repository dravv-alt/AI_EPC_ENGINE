"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type GateOption = { id: string; name: string; status: string };

export function TurnoverActions({ projectId, gates }: { projectId: string; gates: GateOption[] }) {
  const router = useRouter();
  const firstApproved = gates.find((gate) => gate.status === "approved");
  const [gateId, setGateId] = useState(firstApproved?.id ?? gates[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const selectedGate = gates.find((gate) => gate.id === gateId);
  async function generate() {
    const response = await fetch(`/api/projects/${projectId}/turnover-packs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gateId }) });
    const body = await response.json();
    setMessage(response.ok ? `Verified turnover pack ${body.pack.manifestHash.slice(0, 12)}… created.` : body.error);
    if (response.ok) router.refresh();
  }
  return <section className="surface turnover-form"><label>Gate<select value={gateId} onChange={(event) => setGateId(event.target.value)}><option value="" disabled>Select a gate</option>{gates.map((gate) => <option value={gate.id} key={gate.id}>{gate.name} · {gate.status.replaceAll("_", " ")}</option>)}</select></label><button className="button button-primary" onClick={generate} disabled={!gateId || selectedGate?.status !== "approved"}>Generate immutable pack</button><div className="turnover-guidance">{!gates.length ? <><b>No gates are configured.</b><Link href="/systems">Configure gates</Link></> : selectedGate?.status !== "approved" ? <><b>This gate is {selectedGate?.status.replaceAll("_", " ")}.</b><span>Record an authorized approval before export.</span><Link href={`/readiness?gate=${gateId}`}>Open gate readiness</Link></> : <span>Approved gate selected. The pack will include its immutable decision baseline.</span>}</div>{message && <p className="form-message" role="status">{message}</p>}</section>;
}

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { riskSignals, scheduleTasks, shipments } from "@/lib/db/schema";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";

// Slice 11: the Live Events feed unifies the most recent polled signals so the
// demo shows automatic activity. When unfiltered, only signals from the latest
// poll cycle are returned — showing one card per task+signalType, not the entire
// unbounded history. Task/signal-scoped queries (used by verifier) still return
// the full filtered history so assertions work correctly.
type LiveEvent =
  | { kind: "risk"; signal: typeof riskSignals.$inferSelect; taskName: string; at: string }
  | { kind: "ais"; label: string; detail: string; positionSource: string; mmsi: string | null; at: string }
  | { kind: "weather"; label: string; detail: string; weatherDelayFactor: string; status: string; at: string };

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    await requireProjectPermission(projectId, "audit:view");
    const url = new URL(request.url); const signalType = url.searchParams.get("signalType"); const taskId = url.searchParams.get("taskId");
    const conditions = [eq(riskSignals.projectId, projectId)]; if (signalType) conditions.push(eq(riskSignals.signalType, signalType)); if (taskId) conditions.push(eq(riskSignals.taskId, taskId));

    // Scoped queries (used by verifier scripts): return filtered history as-is.
    if (taskId || signalType) {
      const scopedRows = await db.select({ signal: riskSignals, taskName: scheduleTasks.name }).from(riskSignals).innerJoin(scheduleTasks, eq(riskSignals.taskId, scheduleTasks.id)).where(and(...conditions)).orderBy(desc(riskSignals.observedAt)).limit(500);
      return NextResponse.json({ items: scopedRows.map((row) => ({ kind: "risk" as const, signal: row.signal, taskName: row.taskName, at: (row.signal.observedAt as Date).toISOString() })) });
    }

    // Unfiltered feed: only the most recent poll cycle's signals to avoid flooding
    // the UI with every historical observation. Find the latest pollCycleId first.
    const latestSignal = await db.select({ pollCycleId: riskSignals.pollCycleId }).from(riskSignals).where(eq(riskSignals.projectId, projectId)).orderBy(desc(riskSignals.observedAt)).limit(1);
    const riskItems: LiveEvent[] = [];
    if (latestSignal.length) {
      const latestCycleId = latestSignal[0]!.pollCycleId;
      const cycleRows = await db.select({ signal: riskSignals, taskName: scheduleTasks.name }).from(riskSignals).innerJoin(scheduleTasks, eq(riskSignals.taskId, scheduleTasks.id)).where(and(eq(riskSignals.projectId, projectId), eq(riskSignals.pollCycleId, latestCycleId))).orderBy(desc(riskSignals.observedAt));
      riskItems.push(...cycleRows.map((row) => ({ kind: "risk" as const, signal: row.signal, taskName: row.taskName, at: (row.signal.observedAt as Date).toISOString() })));
    }

    const polled = await db.select().from(shipments).where(and(eq(shipments.projectId, projectId), eq(shipments.positionSource, "aisstream"))).orderBy(desc(shipments.lastPolledAt)).limit(100);
    const aisItems: LiveEvent[] = polled.filter((s) => s.lastPolledAt).map((s) => ({ kind: "ais", label: s.name, detail: s.currentLat && s.currentLng ? `Position ${Number(s.currentLat).toFixed(3)}, ${Number(s.currentLng).toFixed(3)} via ${s.positionSource}.` : `Position update via ${s.positionSource}.`, positionSource: s.positionSource, mmsi: s.mmsi, at: (s.lastPolledAt as Date).toISOString() }));

    const weathered = await db.select().from(shipments).where(eq(shipments.projectId, projectId)).orderBy(desc(shipments.lastPolledAt)).limit(100);
    const weatherItems: LiveEvent[] = weathered.filter((s) => s.lastPolledAt).map((s) => ({ kind: "weather", label: s.name, detail: `Status ${s.status} · weather delay factor ${Number(s.weatherDelayFactor).toFixed(2)}${s.weatherAdjustedEta ? ` · adjusted ETA ${(s.weatherAdjustedEta as Date).toISOString()}` : ""}.`, weatherDelayFactor: s.weatherDelayFactor, status: s.status, at: (s.lastPolledAt as Date).toISOString() }));

    const items = [...riskItems, ...aisItems, ...weatherItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load live risk signals." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

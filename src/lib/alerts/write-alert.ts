import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";

// A risk (or shipment/test event) can cycle active -> cleared -> active again
// within the same dedupKey, since a schedule_risk row is reused across its
// whole lifecycle rather than recreated. dedup_key is uniquely constrained
// regardless of status, so an insert-after-checking-only-active-rows race
// (or a genuine re-activation of a previously cleared alert) can hit that
// constraint. An atomic upsert on the dedup_key conflict closes both the
// TOCTOU race and the cleared-alert-reactivation case in one statement.
export async function raiseAlert(input: { projectId: string; eventType: string; dedupKey: string; title: string; payload: Record<string, unknown> }) {
  const [alert] = await db.insert(alerts).values(input)
    .onConflictDoUpdate({ target: alerts.dedupKey, set: { status: "active", title: input.title, payload: input.payload, updatedAt: new Date() } })
    .returning();
  return alert;
}

export async function clearAlerts(projectId: string, dedupKey: string) {
  await db.update(alerts).set({ status: "cleared", updatedAt: new Date() }).where(and(eq(alerts.projectId, projectId), eq(alerts.dedupKey, dedupKey), eq(alerts.status, "active")));
}

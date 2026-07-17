import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts } from "@/lib/db/schema";

export async function raiseAlert(input: { projectId: string; eventType: string; dedupKey: string; title: string; payload: Record<string, unknown> }) {
  const existing = await db.query.alerts.findFirst({ where: and(eq(alerts.projectId, input.projectId), eq(alerts.dedupKey, input.dedupKey), eq(alerts.status, "active")) });
  if (existing) return existing;
  const [alert] = await db.insert(alerts).values(input).returning();
  return alert;
}

export async function clearAlerts(projectId: string, dedupKey: string) {
  await db.update(alerts).set({ status: "cleared", updatedAt: new Date() }).where(and(eq(alerts.projectId, projectId), eq(alerts.dedupKey, dedupKey), eq(alerts.status, "active")));
}

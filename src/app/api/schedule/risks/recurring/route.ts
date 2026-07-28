import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProjectPermission } from "@/lib/projects/access";
import { scheduleRecurringRiskPoll, cancelRecurringRiskPoll } from "@/lib/jobs/recurring";

const bodySchema = z.object({
  projectId: z.string().uuid(),
  action: z.enum(["start", "stop"]),
  intervalMinutes: z.number().int().min(1).max(60).default(5),
});

export async function POST(request: Request) {
  const body = bodySchema.parse(await request.json());
  const actor = await requireProjectPermission(body.projectId, "schedule:manage");

  if (body.action === "stop") {
    const result = await cancelRecurringRiskPoll(body.projectId);
    return NextResponse.json(result);
  }

  const result = await scheduleRecurringRiskPoll({
    projectId: body.projectId,
    actorId: actor.userId,
    intervalMs: body.intervalMinutes * 60_000,
  });
  return NextResponse.json(result, { status: 202 });
}

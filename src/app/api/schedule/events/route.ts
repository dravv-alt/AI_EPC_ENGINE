import { NextResponse } from "next/server";
import { scheduleEventSchema } from "@/lib/events/contract";
import { processScheduleEvent } from "@/lib/events/process";
import { AccessError, requireProjectPermission } from "@/lib/projects/access";
import { enforceScheduleRateLimit } from "@/lib/redis/rate-limit";

export async function POST(request: Request) {
  const parsed = scheduleEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Event does not match the frozen schedule event contract.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const limited = await enforceScheduleRateLimit(`events:${parsed.data.projectId}`);
    if (limited) return limited;
    const actor = await requireProjectPermission(parsed.data.projectId, "schedule:manage");
    const result = await processScheduleEvent(parsed.data, actor.userId);
    return NextResponse.json(result, { status: result.duplicate ? 200 : 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process event." }, { status: error instanceof AccessError ? error.status : 500 });
  }
}

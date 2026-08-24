import { z } from "zod";
import { diffScheduleVersions, getCurrentSchedule } from "@/lib/schedule/read-model";
import type { CopilotTool } from "@/lib/copilot/types";
import { callProjectRoute } from "@/lib/copilot/invoke";

/**
 * Wave 2 (A2-3), Slice 6: schedule.current, schedule.versions, schedule.diff,
 * schedule.risks, events.live, alerts.list. All read-only, all `audit:view` —
 * confirmed against the real route handlers (schedule/versions, schedule/risks,
 * schedule/live-events, alerts all call `requireProjectPermission(projectId,
 * "audit:view")` themselves). `getCurrentSchedule` / `diffScheduleVersions` do
 * NOT self-enforce (ChatbotHarnessPlan.md §2) — `invokeTool` asserts `audit:view`
 * generically before `execute` runs, so these direct-call tools trust that and
 * do not call `requireProjectPermission` themselves.
 *
 * `diffScheduleVersions(versionId, againstId?)` (src/lib/schedule/read-model.ts)
 * already takes version ids and does its own two lookups internally — it does
 * NOT need pre-loaded version objects via `getScheduleVersion`, so `schedule.diff`
 * is a direct one-call wrapper, not a fetch-then-diff composite.
 */
export const tools: CopilotTool[] = [
  {
    name: "schedule.current",
    description: "The project's latest schedule version, with task assignments.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "lib" },
    async execute(ctx) {
      const data = await getCurrentSchedule(ctx.projectId);
      if (!data) return { ok: false, error: "No schedule version exists for this project yet." };
      return { ok: true, data, render: "scheduleTimeline" };
    }
  },
  {
    name: "schedule.versions",
    description: "Every schedule version for the project, newest first, with task assignments.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/schedule/versions` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/schedule/versions`, args, "scheduleTimeline");
    }
  },
  {
    name: "schedule.diff",
    description: "Diff two schedule versions: shifted/added/removed tasks and net deadline impact. Omit againstId to diff against the parent version.",
    permission: "audit:view",
    mutating: false,
    input: z.object({ versionId: z.string().uuid(), againstId: z.string().uuid().optional() }),
    transport: { kind: "lib" },
    async execute(ctx, args) {
      const { versionId, againstId } = args as { versionId: string; againstId?: string };
      const data = await diffScheduleVersions(versionId, againstId);
      if (!data) return { ok: false, error: "Schedule version not found." };
      return { ok: true, data, render: "scheduleTimeline" };
    }
  },
  {
    name: "schedule.risks",
    description: "Predictive schedule risks for the project with source signal status and linked events.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    // No dedicated renderer key in the plan's table for this shape (risk rows,
    // not a timeline of task assignments) — omit `render` and let the drawer
    // fall back to its default JSON display.
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/schedule/risks` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/schedule/risks`, args);
    }
  },
  {
    name: "events.live",
    description: "Live event feed: recent risk signals, AIS position updates, and weather ETA adjustments.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    // No dedicated renderer key in the plan's table for this mixed-kind feed —
    // omit `render` and let the drawer fall back to its default JSON display.
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/schedule/live-events` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/schedule/live-events`, args);
    }
  },
  {
    name: "alerts.list",
    description: "Active and historical alerts for the project.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/alerts` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/alerts`, args, "alertList");
    }
  }
];

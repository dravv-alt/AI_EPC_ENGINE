import { z } from "zod";
import type { CopilotTool } from "@/lib/copilot/types";
import { callProjectRoute } from "@/lib/copilot/invoke";

/**
 * Wave 2 (A2-4) adds shipments.list and shipments.detail to this file.
 * Keep this a plain `export const tools: CopilotTool[] = [ ... ]` array so
 * appending is a one-line addition, not a restructure.
 */
export const tools: CopilotTool[] = [
  {
    name: "shipments.list",
    description: "List every shipment in the project with its current status, ETA, and position source.",
    permission: "audit:view",
    mutating: false,
    input: z.object({}),
    transport: { kind: "http", method: "GET", path: (a) => `/api/projects/${a.projectId}/shipments` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/projects/${a.projectId}/shipments`, args, "shipmentTable");
    }
  },
  {
    name: "shipments.detail",
    description: "Shipment detail including status, planned vs weather-adjusted ETA, position source, and route availability (with reason when unavailable).",
    permission: "audit:view",
    mutating: false,
    input: z.object({ shipmentId: z.string().uuid() }),
    transport: { kind: "http", method: "GET", path: (a) => `/api/shipments/${a.shipmentId}` },
    async execute(ctx, args) {
      return callProjectRoute(ctx, "GET", (a) => `/api/shipments/${a.shipmentId}`, args, "shipmentDetail");
    }
  }
];

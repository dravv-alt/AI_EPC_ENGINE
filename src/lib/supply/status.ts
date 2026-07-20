import { env } from "@/lib/env";

export function calculateShipmentStatus(input: { plannedEta: Date; requiredOnSite: Date; portCongestion: boolean; weatherDelayFactor?: number; now?: Date }) {
  const delayHours = Math.max(0, input.weatherDelayFactor ?? 0) + (input.portCongestion ? 48 : 0);
  const eta = new Date(input.plannedEta.getTime() + delayHours * 3_600_000);
  const hoursToRequired = (input.requiredOnSite.getTime() - eta.getTime()) / 3_600_000;
  const status = hoursToRequired < 0 ? "red" : hoursToRequired < env.SHIPMENT_STATUS_BUFFER_HOURS ? "amber" : "green";
  return { weatherAdjustedEta: eta, status, delayHours: Math.max(0, Math.round((eta.getTime() - input.plannedEta.getTime()) / 3_600_000)), weatherDelayFactor: input.weatherDelayFactor ?? 0, bufferHours: env.SHIPMENT_STATUS_BUFFER_HOURS } as const;
}

export function calculateShipmentStatus(input: { plannedEta: Date; requiredOnSite: Date; portCongestion: boolean }) {
  const delayHours = input.portCongestion ? 72 : 0;
  const eta = new Date(input.plannedEta.getTime() + delayHours * 60 * 60 * 1000);
  const hoursRemaining = (input.requiredOnSite.getTime() - eta.getTime()) / (60 * 60 * 1000);
  return { weatherAdjustedEta: eta, status: hoursRemaining < 0 ? "red" : hoursRemaining < 72 ? "amber" : "green" } as const;
}

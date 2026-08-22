export const claimTaxonomy = [
  { value: "capex", label: "CapEx", metricKey: "capex_delta_pct", unit: "%", help: "Capital cost or budget impact backed by a quote, invoice, BOQ, or estimate." },
  { value: "opex", label: "OpEx", metricKey: "opex_delta_pct", unit: "%", help: "Operating cost impact backed by an energy, service, or operating record." },
  { value: "pue", label: "PUE", metricKey: "pue_delta", unit: "ratio", help: "Power Usage Effectiveness change supported by metered or design evidence." },
  { value: "wue", label: "WUE", metricKey: "wue_delta", unit: "L/kWh", help: "Water Use Effectiveness change supported by water or cooling evidence." },
  { value: "schedule", label: "Schedule", metricKey: "schedule_delta_weeks", unit: "weeks", help: "Programme impact supported by a schedule, delivery, or work record." },
  { value: "footprint", label: "Footprint", metricKey: "footprint_delta_pct", unit: "%", help: "Land, floor, or white-space impact." },
  { value: "grid_load", label: "Grid load", metricKey: "grid_load_delta_mw", unit: "MW", help: "Utility, transformer, generator, or load-study impact." },
  { value: "water", label: "Water", metricKey: "water_demand_delta", unit: "m³/day", help: "Water demand, availability, or treatment impact." },
  { value: "noise", label: "Noise", metricKey: "noise_delta_dba", unit: "dBA", help: "Acoustic measurement or environmental compliance impact." },
  { value: "permitting", label: "Permitting", metricKey: "permitting_status", unit: "status", help: "Permit, authority, or statutory approval evidence." },
  { value: "redundancy", label: "Redundancy", metricKey: "redundancy_topology", unit: "topology", help: "N, N+1, 2N, or other resilience topology claim." },
  { value: "procurement", label: "Procurement", metricKey: "procurement_lead_time_weeks", unit: "weeks", help: "Supplier lead-time, order, or delivery claim." },
  { value: "commissioning", label: "Commissioning", metricKey: "commissioning_status", unit: "status", help: "Test, checklist, or commissioning completion claim." },
  { value: "power_risk", label: "Power risk", metricKey: "power_risk_score", unit: "score", help: "Power availability or reliability risk supported by a controlled source." },
  { value: "permit_risk", label: "Permit risk", metricKey: "permit_risk_score", unit: "score", help: "Approval risk supported by a controlled source." },
  { value: "reliability", label: "Reliability", metricKey: "reliability_impact", unit: "score", help: "Reliability impact backed by technical evidence." },
  { value: "operability", label: "Operability", metricKey: "operability_impact", unit: "score", help: "Operations or maintainability impact." },
  { value: "safety", label: "Safety", metricKey: "safety_impact", unit: "score", help: "Safety impact; never a substitute for formal safety approval." },
  { value: "no_material_impact", label: "No material impact", metricKey: "material_impact", unit: "status", help: "Evidence supports that no quantified material impact was identified." },
  { value: "other", label: "Other", metricKey: "controlled_parameter", unit: "", help: "A controlled, source-backed claim outside the standard data-center dimensions." }
] as const;

export type ClaimType = (typeof claimTaxonomy)[number]["value"];
export const claimTypeValues = claimTaxonomy.map((item) => item.value) as [ClaimType, ...ClaimType[]];

export function claimDefaults(type: string) {
  return claimTaxonomy.find((item) => item.value === type) ?? claimTaxonomy.at(-1)!;
}

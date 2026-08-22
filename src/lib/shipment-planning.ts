export type ShipmentPlanDraft = {
  sourceKey: string;
  category: "power" | "cooling" | "technology" | "network" | "controls" | "commissioning";
  name: string;
  requirementLevel: "must_order" | "confirm_order" | "planning_only";
  rationale: string;
  transportMode: "sea" | "air" | "land";
  sourceAnswers: Record<string, string>;
};

const provided = (answers: Record<string, string>, key: string) => Boolean(answers[key]?.trim());

export function buildShipmentPlan(answers: Record<string, string>): ShipmentPlanDraft[] {
  const plans: ShipmentPlanDraft[] = [];
  const add = (draft: ShipmentPlanDraft) => plans.push(draft);
  const hasCapacity = provided(answers, "target_it_mw") && provided(answers, "utility_mw");
  if (provided(answers, "power_architecture")) add({
    sourceKey: "power-distribution", category: "power", name: "Primary power distribution package",
    requirementLevel: hasCapacity ? "must_order" : "confirm_order", transportMode: "land",
    rationale: `Required by the saved ${answers.power_architecture} power architecture${hasCapacity ? ` for ${answers.target_it_mw} MW IT load` : "; capacity basis is still open"}.`,
    sourceAnswers: { power_architecture: answers.power_architecture, target_it_mw: answers.target_it_mw ?? "", utility_mw: answers.utility_mw ?? "" },
  });
  if (provided(answers, "availability_target")) add({
    sourceKey: "power-resilience", category: "power", name: "UPS and resilience equipment package",
    requirementLevel: hasCapacity ? "must_order" : "confirm_order", transportMode: "land",
    rationale: `Supports the saved ${answers.availability_target} availability target; exact ratings still require vendor evidence.`,
    sourceAnswers: { availability_target: answers.availability_target, target_it_mw: answers.target_it_mw ?? "" },
  });
  if (provided(answers, "cooling_architecture")) add({
    sourceKey: "cooling-package", category: "cooling", name: `${answers.cooling_architecture} heat-rejection package`,
    requirementLevel: provided(answers, "tech_coolant_supply_c") || provided(answers, "coolant_supply_c") ? "must_order" : "confirm_order", transportMode: "land",
    rationale: `Derived from the selected cooling architecture. Confirm the temperature envelope and manufacturer equipment selection before releasing an order.`,
    sourceAnswers: { cooling_architecture: answers.cooling_architecture, coolant_supply_c: answers.coolant_supply_c ?? answers.tech_coolant_supply_c ?? "", water_source: answers.water_source ?? "" },
  });
  if (provided(answers, "platform") && answers.platform !== "Capacity-only / not fixed") add({
    sourceKey: "technology-racks", category: "technology", name: `${answers.platform} rack-scale equipment`,
    requirementLevel: provided(answers, "rack_count") && provided(answers, "rack_kw") ? "confirm_order" : "planning_only", transportMode: "air",
    rationale: `Platform profile is saved as ${answers.platform}. Order confirmation requires an approved technology draft and exact rack quantity/rating.`,
    sourceAnswers: { platform: answers.platform, rack_count: answers.rack_count ?? "", rack_kw: answers.rack_kw ?? "" },
  });
  if (provided(answers, "fabric")) add({
    sourceKey: "network-fabric", category: "network", name: `${answers.fabric} fabric, optics, and structured cabling`,
    requirementLevel: provided(answers, "cable_optics_basis") ? "confirm_order" : "planning_only", transportMode: "air",
    rationale: `Derived from the selected compute fabric. Exact BOM, reach, and interoperability evidence are required before procurement release.`,
    sourceAnswers: { fabric: answers.fabric, fabric_performance: answers.fabric_performance ?? "", cable_optics_basis: answers.cable_optics_basis ?? "" },
  });
  if (provided(answers, "telemetry") || provided(answers, "security_level")) add({
    sourceKey: "controls-security", category: "controls", name: "Controls, telemetry, and physical-security package",
    requirementLevel: "confirm_order", transportMode: "land",
    rationale: `Supports ${answers.telemetry ?? "the saved controls basis"}${answers.security_level ? ` and ${answers.security_level} security` : ""}. Interface definition remains required.`,
    sourceAnswers: { telemetry: answers.telemetry ?? "", security_level: answers.security_level ?? "" },
  });
  if (provided(answers, "commissioning_basis")) add({
    sourceKey: "commissioning-instruments", category: "commissioning", name: "Commissioning instruments and acceptance support",
    requirementLevel: "confirm_order", transportMode: "land",
    rationale: `Supports the saved ${answers.commissioning_basis} acceptance basis. Confirm scope and required-on-site date before booking logistics.`,
    sourceAnswers: { commissioning_basis: answers.commissioning_basis, rfs_date: answers.rfs_date ?? "", long_lead: answers.long_lead ?? "" },
  });
  return plans;
}

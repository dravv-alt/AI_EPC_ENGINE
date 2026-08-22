import { createHash } from "crypto";

export type PlanningWarning = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  stepId: string;
};

export type PlanningAction = {
  title: string;
  detail: string;
  stepId: string;
};

export type PlanningMetrics = {
  targetItMw: number | null;
  calculatedRackItMw: number | null;
  facilityMw: number | null;
  utilityMw: number | null;
  utilityHeadroomMw: number | null;
  pue: number | null;
  liquidHeatMw: number | null;
  liquidSharePct: number | null;
  coolingDeltaTC: number | null;
  planningBudgetUsd: number | null;
  budgetPerMwUsd: number | null;
  evidenceCoveragePct: number;
  resolvedSections: number;
  totalSections: number;
};

const readNumber = (value: string | undefined) => {
  const normalized = value?.replace(/,/g, "").replace(/[%$]/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const isProvided = (answers: Record<string, string>, key: string) =>
  Boolean(answers[key]?.trim());

export function interpretSiteAnalysis(
  answers: Record<string, string>,
  resolvedSections: number,
  totalSections: number,
) {
  const targetItMw = readNumber(answers.target_it_mw);
  const rackCount = readNumber(answers.rack_count);
  const rackKw = readNumber(answers.rack_kw);
  const calculatedRackItMw =
    rackCount !== null && rackKw !== null
      ? Number(((rackCount * rackKw) / 1000).toFixed(2))
      : null;
  const pue = readNumber(answers.pue_target);
  const facilityMw =
    targetItMw !== null && pue !== null
      ? Number((targetItMw * pue).toFixed(2))
      : null;
  const utilityMw = readNumber(answers.utility_mw);
  const liquidSharePct = readNumber(answers.rack_density);
  const liquidHeatMw =
    targetItMw !== null && liquidSharePct !== null
      ? Number(((targetItMw * liquidSharePct) / 100).toFixed(2))
      : null;
  const supply = readNumber(answers.tech_coolant_supply_c);
  const returnTemperature = readNumber(answers.tech_coolant_return_c);
  const budgetPerMwUsd = readNumber(answers.budget_usd_mw);
  const sourceBoundKeys = [
    "pue_target",
    "utility_mw",
    "budget_usd_mw",
    "cooling_performance_reference",
    "hourly_weather_reference",
    "primary_technology_equipment_cost_evidence",
    "facility_heat_rejection_equipment_cost_evidence",
    "residual_air_equipment_cost_evidence",
  ];
  const evidenceCoveragePct = Math.round(
    (sourceBoundKeys.filter((key) => isProvided(answers, key)).length /
      sourceBoundKeys.length) *
      100,
  );
  const warnings: PlanningWarning[] = [];
  const actions: PlanningAction[] = [];
  const warn = (warning: PlanningWarning, action: PlanningAction) => {
    warnings.push(warning);
    actions.push(action);
  };

  if (facilityMw !== null && utilityMw !== null && utilityMw < facilityMw) {
    warn(
      {
        id: "utility-shortfall",
        severity: "critical",
        title: "Utility capacity is below calculated facility demand",
        detail: `Saved utility capacity is ${utilityMw} MW versus an indicative ${facilityMw} MW facility demand (IT load × PUE).`,
        stepId: "power",
      },
      {
        title: "Reconcile the power basis",
        detail:
          "Confirm interconnection capacity, behind-the-meter contribution, and the PUE planning assumption.",
        stepId: "power",
      },
    );
  }
  if (
    targetItMw !== null &&
    calculatedRackItMw !== null &&
    Math.abs(targetItMw - calculatedRackItMw) / Math.max(targetItMw, 0.1) > 0.1
  ) {
    warn(
      {
        id: "rack-load-mismatch",
        severity: "warning",
        title: "Rack plan differs from target IT capacity",
        detail: `Rack count × rack kW produces ${calculatedRackItMw} MW versus a ${targetItMw} MW target.`,
        stepId: "racks",
      },
      {
        title: "Align rack plan and capacity",
        detail:
          "Confirm rack quantity, nameplate kW, diversity, and phased deployment assumptions.",
        stepId: "racks",
      },
    );
  }
  if (
    answers.cooling_architecture === "Air-cooled chiller" &&
    liquidSharePct !== null &&
    liquidSharePct > 50
  ) {
    warn(
      {
        id: "cooling-architecture-conflict",
        severity: "warning",
        title: "Liquid heat share may conflict with air-cooled architecture",
        detail: `${liquidSharePct}% liquid heat share is saved with an air-cooled chiller planning path.`,
        stepId: "cooling",
      },
      {
        title: "Review cooling architecture",
        detail:
          "Confirm the normal liquid and residual-air heat paths and link the equipment interface basis.",
        stepId: "cooling",
      },
    );
  }
  if (!isProvided(answers, "rfs_date") || !isProvided(answers, "long_lead")) {
    warn(
      {
        id: "schedule-basis-open",
        severity: "warning",
        title: "Schedule is missing a dated long-lead basis",
        detail:
          "A ready-for-service target and its critical procurement basis must both be recorded before schedule confidence can be assessed.",
        stepId: "schedule",
      },
      {
        title: "Set schedule evidence",
        detail:
          "Record the RFS target, critical package, lead range, and source document reference.",
        stepId: "schedule",
      },
    );
  }
  for (const [key, label, stepId] of [
    ["budget_usd_mw", "Budget", "commercial"],
    ["pue_target", "PUE", "power"],
    ["water_source", "Water source", "cooling"],
  ] as const) {
    if (!isProvided(answers, key)) {
      warn(
        {
          id: `${key}-missing`,
          severity: "info",
          title: `${label} assumption is open`,
          detail:
            "This planning input has not been saved and cannot be assessed against controlled evidence.",
          stepId,
        },
        {
          title: `Set the ${label.toLowerCase()} basis`,
          detail:
            "Save a planning value and attach or reference the controlling source when available.",
          stepId,
        },
      );
    }
  }
  if (
    supply !== null &&
    returnTemperature !== null &&
    returnTemperature <= supply
  ) {
    warn(
      {
        id: "thermal-delta-invalid",
        severity: "critical",
        title: "Technology return temperature is not above supply",
        detail: `Saved supply is ${supply} °C and return is ${returnTemperature} °C.`,
        stepId: "cooling",
      },
      {
        title: "Correct the thermal state points",
        detail:
          "Confirm the manufacturer envelope and technology-loop supply/return points.",
        stepId: "cooling",
      },
    );
  }
  if (!warnings.length)
    actions.push({
      title: "Link the planning basis to evidence",
      detail:
        "The inputs are internally consistent, but remain planning assumptions until controlled sources are linked and reviewed.",
      stepId: "sources",
    });

  const metrics: PlanningMetrics = {
    targetItMw,
    calculatedRackItMw,
    facilityMw,
    utilityMw,
    utilityHeadroomMw:
      facilityMw !== null && utilityMw !== null
        ? Number((utilityMw - facilityMw).toFixed(2))
        : null,
    pue,
    liquidHeatMw,
    liquidSharePct,
    coolingDeltaTC:
      supply !== null && returnTemperature !== null
        ? Number((returnTemperature - supply).toFixed(2))
        : null,
    planningBudgetUsd:
      targetItMw !== null && budgetPerMwUsd !== null
        ? targetItMw * budgetPerMwUsd
        : null,
    budgetPerMwUsd,
    evidenceCoveragePct,
    resolvedSections,
    totalSections,
  };
  return { metrics, warnings, recommendations: actions };
}

export function siteAnalysisInputHash(answers: Record<string, string>) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    .digest("hex");
}

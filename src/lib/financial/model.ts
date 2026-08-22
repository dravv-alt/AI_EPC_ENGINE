export type FinancialInputs = {
  contractedPowerMw: number; utilizationPct: number; leaseRateUsdMwMonth: number; powerCostUsdKwh: number;
  planningBudgetUsdMw: number; pue: number; discountRatePct: number; analysisPeriodYears: number; usdInrRate: number;
};

export const baseFinancialInputs: FinancialInputs = { contractedPowerMw: 5, utilizationPct: 85, leaseRateUsdMwMonth: 220_000, powerCostUsdKwh: 0.045, planningBudgetUsdMw: 6_000_000, pue: 1.35, discountRatePct: 8, analysisPeriodYears: 15, usdInrRate: 83 };

const presentValue = (cashFlow: number, rate: number, years: number) => Array.from({ length: years }, (_, index) => cashFlow / (1 + rate) ** (index + 1)).reduce((sum, value) => sum + value, 0);
function irr(capex: number, annualCashFlow: number, years: number) {
  let low = -0.99, high = 3;
  for (let iteration = 0; iteration < 100; iteration += 1) { const middle = (low + high) / 2; const value = -capex + presentValue(annualCashFlow, middle, years); if (value > 0) low = middle; else high = middle; }
  return (low + high) / 2;
}

export function calculateFinancialModel(input: FinancialInputs) {
  const effectiveItLoadMw = input.contractedPowerMw * input.utilizationPct / 100;
  const totalPowerDrawMw = effectiveItLoadMw * input.pue;
  const annualRevenue = effectiveItLoadMw * input.leaseRateUsdMwMonth * 12;
  const annualPowerCost = totalPowerDrawMw * 1_000 * 8_760 * input.powerCostUsdKwh;
  const annualGrossProfit = annualRevenue - annualPowerCost;
  const planningBudget = input.contractedPowerMw * input.planningBudgetUsdMw;
  const discountRate = input.discountRatePct / 100;
  const npv = -planningBudget + presentValue(annualGrossProfit, discountRate, input.analysisPeriodYears);
  const projectIrr = annualGrossProfit > 0 ? irr(planningBudget, annualGrossProfit, input.analysisPeriodYears) : null;
  const paybackYears = annualGrossProfit > 0 ? planningBudget / annualGrossProfit : null;
  return { effectiveItLoadMw, totalPowerDrawMw, annualRevenue, monthlyRevenue: annualRevenue / 12, annualPowerCost, annualGrossProfit, grossMarginPct: annualRevenue ? annualGrossProfit / annualRevenue * 100 : 0, planningBudget, npv, projectIrr, paybackYears };
}

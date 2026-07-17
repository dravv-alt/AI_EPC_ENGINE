import { createHash } from "node:crypto";

export type ComplianceVerdict = "conforms" | "deterministic_flag" | "possible_mismatch" | "needs_engineering_judgment" | "equivalent_by_precedent";
export type ComparisonType = "numeric" | "boolean" | "categorical" | "qualitative";

export interface RequirementInput {
  statement: string;
  numericValue: string | null;
  unit: string | null;
  tolerance: string | null;
}

export interface ComparisonResult {
  comparisonType: ComparisonType;
  verdict: ComplianceVerdict;
  confidence: string;
  reason: string;
  requirementSnapshot: Record<string, unknown>;
  targetSnapshot: Record<string, unknown>;
}

type UnitDefinition = { dimension: string; factor: number; offset?: number; canonical: string };

const units: Record<string, UnitDefinition> = {
  pa: { dimension: "pressure", factor: 1, canonical: "Pa" },
  kpa: { dimension: "pressure", factor: 1_000, canonical: "kPa" },
  bar: { dimension: "pressure", factor: 100_000, canonical: "bar" },
  psi: { dimension: "pressure", factor: 6_894.757293, canonical: "psi" },
  w: { dimension: "power", factor: 1, canonical: "W" },
  kw: { dimension: "power", factor: 1_000, canonical: "kW" },
  mw: { dimension: "power", factor: 1_000_000, canonical: "MW" },
  v: { dimension: "voltage", factor: 1, canonical: "V" },
  kv: { dimension: "voltage", factor: 1_000, canonical: "kV" },
  hz: { dimension: "frequency", factor: 1, canonical: "Hz" },
  "%": { dimension: "percentage", factor: 1, canonical: "%" },
  rpm: { dimension: "rotation", factor: 1, canonical: "rpm" },
  mm: { dimension: "length", factor: 0.001, canonical: "mm" },
  cm: { dimension: "length", factor: 0.01, canonical: "cm" },
  m: { dimension: "length", factor: 1, canonical: "m" },
  "l/s": { dimension: "flow", factor: 1, canonical: "L/s" },
  "m3/h": { dimension: "flow", factor: 1_000 / 3_600, canonical: "m³/h" },
  "m³/h": { dimension: "flow", factor: 1_000 / 3_600, canonical: "m³/h" },
  c: { dimension: "temperature", factor: 1, canonical: "°C" },
  "°c": { dimension: "temperature", factor: 1, canonical: "°C" }
};

const numericPattern = /(-?\d+(?:\.\d+)?)\s*(kPa|Pa|bar|psi|kV|V|MW|kW|W|Hz|°C|C|%|l\/s|L\/s|m3\/h|m³\/h|rpm|mm|cm|m)(?=\s|[.,;)]|$)/i;

function normalizeUnit(value: string) {
  return value.trim().replace("L/s", "l/s").toLowerCase();
}

function unitDefinition(value: string) {
  return units[normalizeUnit(value)];
}

function convert(value: number, from: UnitDefinition, to: UnitDefinition) {
  if (from.dimension !== to.dimension) return null;
  const base = (value + (from.offset ?? 0)) * from.factor;
  return base / to.factor - (to.offset ?? 0);
}

function explicitBoolean(text: string): boolean | null {
  const normalized = text.toLowerCase();
  if (/\b(not\s+provided|not\s+present|not\s+available|disabled|absent|no|fail(?:ed)?|non[- ]compliant)\b/.test(normalized)) return false;
  if (/\b(provided|present|available|enabled|yes|pass(?:ed)?|compliant)\b/.test(normalized)) return true;
  return null;
}

function categoricalValue(text: string) {
  const explicit = text.match(/\b(?:type|class|category|material|rating)\s*[:=]\s*([a-z0-9][a-z0-9 ._\/-]{0,80})/i)?.[1];
  const requirement = text.match(/\b(?:shall|must)\s+be\s+(?:of\s+)?(?:type|class|category|material|rating)?\s*[:=]?\s*([a-z0-9][a-z0-9 ._\/-]{0,80})/i)?.[1];
  const candidate = explicit ?? requirement;
  return candidate?.replace(/[.;,].*$/, "").trim().toLowerCase() ?? null;
}

export function normalizedContentHash(text: string) {
  return createHash("sha256").update(text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase()).digest("hex");
}

export function compareCompliance(requirement: RequirementInput, targetText: string, acceptedPrecedent = false): ComparisonResult {
  const requirementSnapshot: Record<string, unknown> = { statement: requirement.statement, numericValue: requirement.numericValue, unit: requirement.unit, tolerance: requirement.tolerance };
  const targetSnapshot: Record<string, unknown> = { text: targetText, contentFingerprint: normalizedContentHash(targetText) };

  if (acceptedPrecedent) {
    return { comparisonType: "qualitative", verdict: "equivalent_by_precedent", confidence: "1.0000", reason: "An explicitly accepted project precedent matches this requirement and exact normalized target line. The precedent remains advisory context; this check still requires review.", requirementSnapshot, targetSnapshot };
  }

  if (requirement.numericValue !== null && requirement.unit) {
    const match = targetText.match(numericPattern);
    if (!match) return { comparisonType: "numeric", verdict: "needs_engineering_judgment", confidence: "0.0000", reason: "The accepted requirement is numeric, but the cited target line has no controlled numeric value and unit.", requirementSnapshot, targetSnapshot };
    const targetValue = Number(match[1]);
    const targetUnit = match[2];
    const requiredUnit = unitDefinition(requirement.unit);
    const foundUnit = unitDefinition(targetUnit);
    targetSnapshot.numericValue = targetValue;
    targetSnapshot.unit = targetUnit;
    if (!requiredUnit || !foundUnit || requiredUnit.dimension !== foundUnit.dimension) {
      return { comparisonType: "numeric", verdict: "deterministic_flag", confidence: "1.0000", reason: `The cited target unit ${targetUnit} is not compatible with the controlled requirement unit ${requirement.unit}.`, requirementSnapshot, targetSnapshot };
    }
    const converted = convert(targetValue, foundUnit, requiredUnit)!;
    const expected = Number(requirement.numericValue);
    const tolerance = Number(requirement.tolerance ?? 0);
    const deviation = Math.abs(converted - expected);
    Object.assign(targetSnapshot, { convertedValue: converted, convertedUnit: requiredUnit.canonical, deviation });
    return deviation <= tolerance
      ? { comparisonType: "numeric", verdict: "conforms", confidence: "1.0000", reason: `Deterministic unit-normalized comparison: ${targetValue} ${targetUnit} = ${converted} ${requiredUnit.canonical}; allowed ${expected} ± ${tolerance} ${requiredUnit.canonical}.`, requirementSnapshot, targetSnapshot }
      : { comparisonType: "numeric", verdict: "deterministic_flag", confidence: "1.0000", reason: `Deterministic unit-normalized deviation: ${targetValue} ${targetUnit} = ${converted} ${requiredUnit.canonical}; required ${expected} ± ${tolerance} ${requiredUnit.canonical}.`, requirementSnapshot, targetSnapshot };
  }

  const expectedBoolean = explicitBoolean(requirement.statement);
  const targetBoolean = explicitBoolean(targetText);
  if (expectedBoolean !== null && targetBoolean !== null) {
    Object.assign(requirementSnapshot, { booleanValue: expectedBoolean });
    Object.assign(targetSnapshot, { booleanValue: targetBoolean });
    return expectedBoolean === targetBoolean
      ? { comparisonType: "boolean", verdict: "conforms", confidence: "1.0000", reason: "The explicit boolean/presence value in the cited target line matches the accepted requirement.", requirementSnapshot, targetSnapshot }
      : { comparisonType: "boolean", verdict: "deterministic_flag", confidence: "1.0000", reason: "The explicit boolean/presence value in the cited target line conflicts with the accepted requirement.", requirementSnapshot, targetSnapshot };
  }

  const expectedCategory = categoricalValue(requirement.statement);
  const targetCategory = categoricalValue(targetText);
  if (expectedCategory && targetCategory) {
    Object.assign(requirementSnapshot, { categoricalValue: expectedCategory });
    Object.assign(targetSnapshot, { categoricalValue: targetCategory });
    return expectedCategory === targetCategory
      ? { comparisonType: "categorical", verdict: "conforms", confidence: "1.0000", reason: "The explicit controlled categorical callout matches exactly after normalization.", requirementSnapshot, targetSnapshot }
      : { comparisonType: "categorical", verdict: "deterministic_flag", confidence: "1.0000", reason: `The explicit controlled categorical callout differs: required “${expectedCategory}”, target “${targetCategory}”.`, requirementSnapshot, targetSnapshot };
  }

  return { comparisonType: "qualitative", verdict: "possible_mismatch", confidence: "0.0000", reason: "This comparison is qualitative. No deterministic conformity decision or equivalence claim is permitted; an engineer must review both exact citations.", requirementSnapshot, targetSnapshot };
}

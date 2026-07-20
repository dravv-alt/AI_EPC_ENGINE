/** Presentation-only helpers. Never use these values for comparisons or persistence. */
export function compactHash(value: string | null | undefined, prefix = 10, suffix = 6) {
  if (!value) return "No immutable hash";
  if (value.length <= prefix + suffix + 1) return value;
  return `${value.slice(0, prefix)}…${value.slice(-suffix)}`;
}

export function formatMeasurement(value: string | number | null | undefined, maximumFractionDigits = 3) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(numeric);
}

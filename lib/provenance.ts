// How a fee or yield figure was sourced, and the text that explains it.

export const YAHOO_QUOTE_SOURCE = "Yahoo Finance quote";

interface FieldProvenance {
  sourceField?: string | null;
  inputUnit?: string | null;
  normalization?: string | null;
  measurementDate?: string | null;
}

function fieldParts({ sourceField, inputUnit, normalization, measurementDate }: FieldProvenance): string[] {
  const parts: string[] = [];
  if (sourceField) parts.push(`field ${sourceField}`);
  if (inputUnit) parts.push(`input unit: ${inputUnit}`);
  if (normalization) parts.push(`normalized as ${normalization}`);
  parts.push(measurementDate ? `measurement date ${measurementDate}` : "measurement date not supplied");
  return parts;
}

function retrievedPart(retrievedAt: string | null | undefined): string[] {
  if (!retrievedAt) return [];
  const date = new Date(retrievedAt);
  return Number.isFinite(date.getTime()) ? [`Retrieved ${date.toLocaleDateString()}`] : [];
}

export function getSourcedExpenseRatio(
  metrics: { mer?: number | null; merSource?: string | null } | null | undefined,
): number | null {
  const value = metrics?.mer;
  if (
    !metrics?.merSource?.trim() ||
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }
  return value;
}

export function describeExpenseRatioProvenance(
  metrics: {
    merSource?: string | null;
    merSourceField?: string | null;
    merInputUnit?: string | null;
    merNormalization?: string | null;
    merMeasurementDate?: string | null;
    merRetrievedAt?: string | null;
  } | null | undefined,
): string | undefined {
  const source = metrics?.merSource?.trim();
  if (!source) return undefined;
  return [
    source,
    ...fieldParts({
      sourceField: metrics?.merSourceField,
      inputUnit: metrics?.merInputUnit,
      normalization: metrics?.merNormalization,
      measurementDate: metrics?.merMeasurementDate,
    }),
    ...retrievedPart(metrics?.merRetrievedAt),
    "Canadian MER equivalence unverified",
  ].join(" · ");
}

export function isUnverifiedProviderYield(source: string | null | undefined): boolean {
  return source?.trim().toLowerCase() === YAHOO_QUOTE_SOURCE.toLowerCase();
}

export function getSourcedYield(
  metrics: { yield?: number | null; yieldSource?: string | null } | null | undefined,
  fallback?: number | null,
): number | null {
  if (!metrics?.yieldSource?.trim()) return null;
  if (isUnverifiedProviderYield(metrics.yieldSource)) return null;
  const value = metrics.yield ?? fallback;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function describeYieldProvenance(
  metrics: {
    yieldSource?: string | null;
    yieldRetrievedAt?: string | null;
    yieldSourceField?: string | null;
    yieldInputUnit?: string | null;
    yieldNormalization?: string | null;
    yieldMeasurementDate?: string | null;
  } | null | undefined,
): string | undefined {
  const source = metrics?.yieldSource;
  const normalization = metrics?.yieldNormalization;
  const measurementDate = metrics?.yieldMeasurementDate;
  const parts: string[] = [];
  if (isUnverifiedProviderYield(source)) {
    parts.push(
      "Yahoo Finance quote yield unavailable · definition and measurement date unverified",
      ...fieldParts({
        sourceField: metrics?.yieldSourceField,
        inputUnit: metrics?.yieldInputUnit,
        normalization,
        measurementDate,
      }),
      "raw provider value retained for reconciliation; definition may differ from issuer yield measures",
    );
  } else if (source) {
    parts.push(source);
    if (normalization) parts.push(normalization);
    if (measurementDate) parts.push(`measurement date ${measurementDate}`);
  }
  parts.push(...retrievedPart(metrics?.yieldRetrievedAt));
  return parts.length ? parts.join(" · ") : undefined;
}

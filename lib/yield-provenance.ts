const YAHOO_QUOTE_SOURCE = "Yahoo Finance quote";

export function getSourcedYield(
  metrics: { yield?: number | null; yieldSource?: string | null } | null | undefined,
  fallback?: number | null,
): number | null {
  if (!metrics?.yieldSource?.trim()) return null;
  if (isUnverifiedProviderYield(metrics.yieldSource)) return null;
  const value = metrics.yield ?? fallback;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function isUnverifiedProviderYield(source: string | null | undefined): boolean {
  return source?.trim().toLowerCase() === YAHOO_QUOTE_SOURCE.toLowerCase();
}

export function describeYieldProvenance(
  source: string | null | undefined,
  retrievedAt?: string | null,
  sourceField?: string | null,
  inputUnit?: string | null,
  normalization?: string | null,
  measurementDate?: string | null,
): string | undefined {
  const parts: string[] = [];
  if (isUnverifiedProviderYield(source)) {
    parts.push("Yahoo Finance quote yield unavailable · definition and measurement date unverified");
    if (sourceField) parts.push(`field ${sourceField}`);
    if (inputUnit) parts.push(`input unit: ${inputUnit}`);
    if (normalization) parts.push(`normalized as ${normalization}`);
    parts.push(measurementDate ? `measurement date ${measurementDate}` : "measurement date not supplied");
    parts.push("raw provider value retained for reconciliation; definition may differ from issuer yield measures");
  } else if (source) {
    parts.push(source);
  }
  if (retrievedAt) {
    const date = new Date(retrievedAt);
    if (Number.isFinite(date.getTime())) parts.push(`Retrieved ${date.toLocaleDateString()}`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

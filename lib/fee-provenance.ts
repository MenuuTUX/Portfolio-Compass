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
  const parts = [source];
  if (metrics?.merSourceField) parts.push(`field ${metrics.merSourceField}`);
  if (metrics?.merInputUnit) parts.push(`input unit: ${metrics.merInputUnit}`);
  if (metrics?.merNormalization) parts.push(`normalized as ${metrics.merNormalization}`);
  parts.push(metrics?.merMeasurementDate
    ? `measurement date ${metrics.merMeasurementDate}`
    : "measurement date not supplied");
  const retrievedAt = metrics?.merRetrievedAt;
  if (retrievedAt && Number.isFinite(Date.parse(retrievedAt))) {
    parts.push(`Retrieved ${new Date(retrievedAt).toLocaleDateString()}`);
  }
  parts.push("Canadian MER equivalence unverified");
  return parts.join(" · ");
}

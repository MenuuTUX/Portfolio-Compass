import { Portfolio } from "@/types";

export interface PortfolioFlowNode {
  name: string;
  value: number;
}

export interface PortfolioFlowLink {
  source: number;
  target: number;
  value: number;
}

export interface PortfolioFlowData {
  nodes: PortfolioFlowNode[];
  links: PortfolioFlowLink[];
}

const MAX_SOURCE_NODES = 8;

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function addFlow(
  flows: Map<string, Map<string, number>>,
  source: string,
  target: string,
  value: number,
) {
  if (!Number.isFinite(value) || value <= 0) return;

  const sourceFlows = flows.get(source) ?? new Map<string, number>();
  sourceFlows.set(target, (sourceFlows.get(target) ?? 0) + value);
  flows.set(source, sourceFlows);
}

function normalizedSectorEntries(item: Portfolio[number]) {
  const entries = Object.entries(item.sectors ?? {}).filter(
    ([, value]) => Number.isFinite(value) && value > 0,
  );

  if (entries.length === 0) return [];

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const scale = total > 1.5 ? 0.01 : 1;

  return entries.map(([sector, value]) => [titleCase(sector), value * scale] as const);
}

/**
 * Convert top-level portfolio weights into a compact holding → sector → total
 * flow. The source grouping keeps the diagram legible for larger portfolios.
 */
export function getPortfolioFlowData(portfolio: Portfolio): PortfolioFlowData {
  const rawFlows = new Map<string, Map<string, number>>();

  portfolio.forEach((item) => {
    const weight = Number.isFinite(item.weight) ? Math.max(0, item.weight) : 0;
    if (weight === 0) return;

    const sectorEntries = normalizedSectorEntries(item);
    const classifiedTotal = sectorEntries.reduce(
      (sum, [, share]) => sum + share,
      0,
    );

    if (sectorEntries.length > 0) {
      sectorEntries.forEach(([sector, share]) => {
        addFlow(rawFlows, item.ticker, sector, weight * share);
      });

      if (classifiedTotal < 0.995) {
        addFlow(
          rawFlows,
          item.ticker,
          "Unclassified",
          weight * (1 - classifiedTotal),
        );
      }
      return;
    }

    addFlow(rawFlows, item.ticker, titleCase(item.sector ?? "Unclassified"), weight);
  });

  const allocated = [...rawFlows.values()].reduce(
    (total, sourceFlows) =>
      total + [...sourceFlows.values()].reduce((sum, value) => sum + value, 0),
    0,
  );
  const cashBuffer = Math.max(0, 100 - allocated);
  if (cashBuffer > 0.01) addFlow(rawFlows, "Cash buffer", "Cash", cashBuffer);

  const sourceTotals = [...rawFlows.entries()]
    .map(([source, sourceFlows]) => ({
      source,
      total: [...sourceFlows.values()].reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => b.total - a.total);

  if (sourceTotals.length === 0) return { nodes: [], links: [] };

  const cashSource = sourceTotals.find((entry) => entry.source === "Cash buffer");
  const regularSources = sourceTotals.filter(
    (entry) => entry.source !== "Cash buffer",
  );
  const visibleRegularSources = regularSources.slice(
    0,
    Math.max(1, MAX_SOURCE_NODES - (cashSource ? 1 : 0)),
  );
  const visibleSources = cashSource
    ? [...visibleRegularSources, cashSource]
    : visibleRegularSources;
  const visibleSourceNames = new Set(visibleSources.map((entry) => entry.source));
  const groupedSources = sourceTotals.filter(
    (entry) => !visibleSourceNames.has(entry.source),
  );

  if (groupedSources.length > 0) {
    visibleSources.push({
      source: "Other holdings",
      total: groupedSources.reduce((sum, entry) => sum + entry.total, 0),
    });
  }

  const groupedFlows = new Map<string, Map<string, number>>();
  rawFlows.forEach((sourceFlows, source) => {
    const displaySource = visibleSourceNames.has(source) ? source : "Other holdings";
    sourceFlows.forEach((value, sector) => {
      addFlow(groupedFlows, displaySource, sector, value);
    });
  });

  const sectorTotals = new Map<string, number>();
  groupedFlows.forEach((sourceFlows) => {
    sourceFlows.forEach((value, sector) => {
      sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + value);
    });
  });

  const orderedSectors = [...sectorTotals.entries()].sort((a, b) => b[1] - a[1]);
  const nodes: PortfolioFlowNode[] = [
    ...visibleSources.map(({ source, total }) => ({ name: source, value: total })),
    ...orderedSectors.map(([name, value]) => ({ name, value })),
    {
      name: "Portfolio total",
      value: orderedSectors.reduce((sum, [, value]) => sum + value, 0),
    },
  ];
  const nodeIndex = new Map(nodes.map((node, index) => [node.name, index]));
  const links: PortfolioFlowLink[] = [];

  groupedFlows.forEach((sourceFlows, source) => {
    sourceFlows.forEach((value, sector) => {
      links.push({
        source: nodeIndex.get(source) as number,
        target: nodeIndex.get(sector) as number,
        value,
      });
    });
  });

  const totalIndex = nodeIndex.get("Portfolio total") as number;
  orderedSectors.forEach(([sector, value]) => {
    links.push({
      source: nodeIndex.get(sector) as number,
      target: totalIndex,
      value,
    });
  });

  return { nodes, links };
}

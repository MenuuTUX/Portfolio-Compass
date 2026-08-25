import { Info } from "lucide-react";

interface CorrelationHeatmapProps {
  assets: string[];
}

export default function CorrelationHeatmap({
  assets,
}: CorrelationHeatmapProps) {
  return (
    <div className="w-full min-h-[240px] glass-panel p-6 rounded-xl flex flex-col items-center justify-center text-center gap-3">
      <Info className="w-6 h-6 text-neutral-500" />
      <div>
        <h3 className="text-sm font-medium text-neutral-200">
          Correlation Matrix Unavailable
        </h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-md">
          {assets.length < 2
            ? "Add at least two holdings to calculate pairwise correlations."
            : "This build does not calculate a historical correlation matrix, so no correlation values are shown."}
        </p>
      </div>
    </div>
  );
}

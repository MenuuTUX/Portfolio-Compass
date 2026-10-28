import type { ReactNode } from "react";

interface SummaryCardProps {
  title: string;
  sub?: ReactNode;
  /** Logo or icon before the text. */
  leading?: ReactNode;
  /** Small visual on the right, e.g. a sparkline or bar. */
  trailing?: ReactNode;
}

export default function SummaryCard({ title, sub, leading, trailing }: SummaryCardProps) {
  return (
    <div className="ws-card flex items-center justify-between gap-4 px-6 py-4 min-w-0">
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-bold text-ink">{title}</h3>
        {sub && <div className="mt-0.5 text-xs text-muted truncate">{sub}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

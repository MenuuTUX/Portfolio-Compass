"use client";

import * as React from "react";
import {
  Info,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StockInfo {
  sector: string;
  industry: string;
  description: string | null;
}

function DescriptionText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const MAX_LENGTH = 350;
  const shouldTruncate = text.length > MAX_LENGTH;

  const displayText =
    shouldTruncate && !isExpanded
      ? text.slice(0, MAX_LENGTH).trim() + "..."
      : text;

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs text-body-strong leading-relaxed whitespace-pre-wrap">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="min-h-8 text-xs font-medium text-compass hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass rounded"
        >
          {isExpanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}

interface AssetProfileCardProps {
  ticker: string;
  assetType?: "STOCK" | "ETF";
  className?: string;
  description?: string; // Optional override
}

export default function AssetProfileCard({
  ticker,
  assetType = "STOCK",
  className,
  description: descriptionProp,
}: AssetProfileCardProps) {
  const [info, setInfo] = React.useState<StockInfo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function fetchInfo() {
      if (!ticker) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/stock/info?ticker=${encodeURIComponent(ticker)}`,
        );
        if (!res.ok) {
          // Even if it fails, we treat it as "no info" rather than a hard error
          throw new Error("Failed to fetch");
        }
        const data = await res.json();
        if (mounted) {
          setInfo(data);
        }
      } catch {
        if (mounted) {
          // Silent fail - we will show "Description unavailable"
          setInfo(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchInfo();

    return () => {
      mounted = false;
    };
  }, [ticker]);

  if (loading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          {assetType === "STOCK" && (
            <div className="mt-4 p-4 rounded-lg bg-surface-soft">
              <Skeleton className="h-20 w-full" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Use prop description if available, otherwise fetch result
  const description = descriptionProp || info?.description;
  const sector = info?.sector;
  const industry = info?.industry;

  return (
    <section className={cn("w-full flex flex-col gap-3", className)} aria-label={`About ${ticker}`}>
      <h3 className="text-sm font-bold text-ink">About {ticker}</h3>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-body-strong">
          {assetType === "ETF" ? "ETF" : "Stock"}
        </span>
        {sector && sector !== "Unknown" && (
          <span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-body-strong">
            {sector}
          </span>
        )}
        {industry && industry !== "Unknown" && (
          <span className="rounded-full bg-surface-soft px-3 py-1 text-xs text-body-strong">
            {industry}
          </span>
        )}
      </div>

      {description ? (
        <DescriptionText text={description} />
      ) : (
        <div className="flex items-center gap-2 text-muted text-xs">
          <Info className="w-4 h-4" aria-hidden="true" />
          <span>Asset description not available.</span>
        </div>
      )}
    </section>
  );
}

"use client";

import * as React from "react";
import {
  Layers,
  Factory,
  BookOpen,
  Info,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
      <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-sans">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none transition-colors"
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
      <Card
        className={cn(
          "w-full h-full bg-transparent border-none shadow-none p-0",
          className,
        )}
      >
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
            <div className="mt-4 p-4 border border-hairline rounded-xl bg-surface-card">
              <Skeleton className="h-20 w-full" />
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Use prop description if available, otherwise fetch result
  const description = descriptionProp || info?.description;
  const sector = info?.sector;
  const industry = info?.industry;

  return (
    <div className={cn("w-full h-full flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2 text-ink mb-1">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-bold">About {ticker}</h3>
      </div>

      {/* Header Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-md"
        >
          {assetType === "ETF" ? "ETF" : "STOCK"}
        </Badge>
        {sector && sector !== "Unknown" && (
          <Badge
            variant="outline"
            className="border-hairline text-neutral-300 gap-1.5 px-2 py-0.5 font-normal"
          >
            <Layers className="w-3 h-3 text-neutral-400" />
            {sector}
          </Badge>
        )}
        {industry && industry !== "Unknown" && (
          <Badge
            variant="outline"
            className="border-hairline text-neutral-300 gap-1.5 px-2 py-0.5 font-normal"
          >
            <Factory className="w-3 h-3 text-neutral-400" />
            {industry}
          </Badge>
        )}
      </div>

      {/* Description */}
      {description ? (
        <DescriptionText text={description} />
      ) : (
        <div className="flex items-center gap-2 py-4 text-neutral-500 text-sm italic">
          <Info className="w-4 h-4" />
          <span>Asset description not available.</span>
        </div>
      )}

    </div>
  );
}

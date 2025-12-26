"use client"

import * as React from "react"
import { Layers, AlertCircle, TrendingUp, Target, Factory, BookOpen, Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StockInfo {
  sector: string
  industry: string
  description: string | null
  analyst?: {
    summary: string
    consensus: string
    targetPrice: number | null
    targetUpside: number | null
  }
}

function DescriptionText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const MAX_LENGTH = 350
  const shouldTruncate = text.length > MAX_LENGTH

  const displayText = shouldTruncate && !isExpanded
    ? text.slice(0, MAX_LENGTH).trim() + "..."
    : text

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
  )
}

interface AssetProfileCardProps {
  ticker: string
  assetType?: 'STOCK' | 'ETF'
  className?: string
  description?: string // Optional override
}

export default function AssetProfileCard({ ticker, assetType = 'STOCK', className, description: descriptionProp }: AssetProfileCardProps) {
  const [info, setInfo] = React.useState<StockInfo | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true

    async function fetchInfo() {
      if (!ticker) return

      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/stock/info?ticker=${encodeURIComponent(ticker)}`)
        if (!res.ok) {
           // Even if it fails, we treat it as "no info" rather than a hard error
           throw new Error("Failed to fetch")
        }
        const data = await res.json()
        if (mounted) {
          setInfo(data)
        }
      } catch (err) {
        if (mounted) {
           // Silent fail - we will show "Description unavailable"
           setInfo(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchInfo()

    return () => {
      mounted = false
    }
  }, [ticker])

  if (loading) {
    return (
      <Card className={cn("w-full h-full bg-transparent border-none shadow-none p-0", className)}>
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
            {assetType === 'STOCK' && (
                <div className="mt-4 p-4 border border-white/5 rounded-xl bg-white/5">
                    <Skeleton className="h-20 w-full" />
                </div>
            )}
        </div>
      </Card>
    )
  }

  // Use prop description if available, otherwise fetch result
  const description = descriptionProp || info?.description;
  const sector = info?.sector;
  const industry = info?.industry;

  return (
    <div className={cn("w-full h-full flex flex-col gap-4", className)}>

      <div className="flex items-center gap-2 text-white mb-1">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-bold">About {ticker}</h3>
      </div>

      {/* Header Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            {assetType === 'ETF' ? 'ETF' : 'STOCK'}
        </Badge>
        {sector && sector !== 'Unknown' && (
            <Badge variant="outline" className="border-white/10 text-neutral-300 gap-1.5 px-2 py-0.5 font-normal">
                <Layers className="w-3 h-3 text-neutral-400" />
                {sector}
            </Badge>
        )}
        {industry && industry !== 'Unknown' && (
            <Badge variant="outline" className="border-white/10 text-neutral-300 gap-1.5 px-2 py-0.5 font-normal">
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

      {/* Analyst Analysis Section - Only for Stocks */}
      {assetType === 'STOCK' && info?.analyst && (
        <div className="space-y-4 pt-4 mt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-white">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-wide">Analyst Summary</h3>
            </div>

            <div className="relative pl-4 border-l-2 border-emerald-500/30 py-1">
                <p className="text-sm text-neutral-300 italic leading-relaxed">
                    "{info.analyst.summary}"
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
                {/* Consensus Card */}
                <div className="bg-gradient-to-br from-white/5 to-white/0 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center shadow-sm">
                    <span className="text-[10px] text-neutral-500 mb-1.5 uppercase tracking-wider font-semibold">Consensus</span>
                    <Badge
                        variant="secondary"
                        className={cn(
                        "text-sm font-bold px-3 py-1",
                        info.analyst.consensus.toLowerCase().includes('buy') ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" :
                        info.analyst.consensus.toLowerCase().includes('sell') ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30" :
                        "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    )}>
                        {info.analyst.consensus}
                    </Badge>
                </div>

                {/* Price Target Card */}
                <div className="bg-gradient-to-br from-white/5 to-white/0 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center text-center shadow-sm">
                    <span className="text-[10px] text-neutral-500 mb-1.5 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Target
                    </span>
                    <div className="text-lg font-bold text-white tracking-tight">
                        {info.analyst.targetPrice ? `$${info.analyst.targetPrice.toFixed(2)}` : 'N/A'}
                    </div>
                    {info.analyst.targetUpside !== null && (
                        <div className={cn(
                            "text-[10px] font-medium mt-0.5",
                            info.analyst.targetUpside >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {info.analyst.targetUpside >= 0 ? '▲' : '▼'} {Math.abs(info.analyst.targetUpside).toFixed(1)}%
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

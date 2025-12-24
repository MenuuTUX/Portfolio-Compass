"use client"

import * as React from "react"
import { Layers, AlertCircle, TrendingUp, Target } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StockInfo {
  sector: string
  industry: string
  description: string
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
    <div className="flex flex-col items-start gap-1">
      <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline focus:outline-none transition-colors"
        >
          {isExpanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  )
}

interface StockInfoCardProps {
  ticker: string
}

export default function StockInfoCard({ ticker }: StockInfoCardProps) {
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
          throw new Error("Failed to fetch asset profile")
        }
        const data = await res.json()
        if (mounted) {
          setInfo(data)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unknown error")
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
      <Card className="w-full h-full">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <Skeleton className="h-32 w-32 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !info) {
    return (
      <Card className="w-full h-full border-red-500/20 bg-red-500/5">
        <CardHeader>
           <CardTitle className="text-red-400 flex items-center gap-2">
             <AlertCircle className="h-5 w-5" />
             Error
           </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-300">
            {error || "Could not load asset profile."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full h-full flex flex-col bg-transparent border-0 shadow-none p-0">
      <div className="flex-1 flex flex-col gap-8 min-h-0 overflow-y-auto pr-2 custom-scrollbar">

        {/* Description & Sector */}
        <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center justify-center h-28 w-28 shrink-0 p-2 text-center">
                <Layers className="h-6 w-6 text-emerald-500 mb-2" />
                <Badge variant="secondary" className="mb-1 text-[10px] h-4 px-1.5 pointer-events-none">
                    SECTOR
                </Badge>
                <span className="text-xs font-bold text-stone-100 line-clamp-2 leading-tight">
                    {info.sector || "Unknown"}
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <DescriptionText text={info.description || "No description available."} />
            </div>
        </div>

        {/* Analyst Analysis Text */}
        {info.analyst && (
            <div className="pt-6 border-t border-white/5">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Analyst Summary
                </h3>
                <p className="text-sm text-stone-300 italic mb-4">
                    {info.analyst.summary}
                </p>

                <div className="grid grid-cols-2 gap-4">
                    {/* Consensus */}
                    <div className="flex flex-col items-center justify-center text-center p-3">
                        <span className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Consensus</span>
                        <div className={cn(
                            "text-lg font-bold",
                            info.analyst.consensus.toLowerCase().includes('buy') ? "text-emerald-400" :
                            info.analyst.consensus.toLowerCase().includes('sell') ? "text-rose-400" :
                            "text-amber-400"
                        )}>
                            {info.analyst.consensus}
                        </div>
                    </div>

                    {/* Price Target */}
                    <div className="flex flex-col items-center justify-center text-center p-3">
                         <span className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                             <Target className="w-3 h-3" />
                             Price Target
                         </span>
                         <div className="text-lg font-bold text-white">
                             {info.analyst.targetPrice ? `$${info.analyst.targetPrice.toFixed(2)}` : 'N/A'}
                         </div>
                         {info.analyst.targetUpside !== null && (
                             <div className={cn(
                                 "text-[10px] font-medium",
                                 info.analyst.targetUpside >= 0 ? "text-emerald-400" : "text-rose-400"
                             )}>
                                 {info.analyst.targetUpside >= 0 ? '+' : ''}{info.analyst.targetUpside.toFixed(2)}%
                             </div>
                         )}
                    </div>
                </div>
            </div>
        )}

      </div>
    </Card>
  )
}

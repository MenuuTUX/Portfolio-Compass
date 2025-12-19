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
          <div className="space-y-2">
             <Skeleton className="h-6 w-48" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-20 w-full" />
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
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <CardTitle>Asset Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">

        {/* Top Section: Sector & Description */}
        <div className="flex flex-col sm:flex-row gap-6">
            {/* Sector Square */}
            <div className="flex flex-col items-center justify-center h-32 w-32 shrink-0 rounded-lg bg-stone-800/50 p-4 text-center border border-white/5 shadow-inner">
            <Layers className="h-8 w-8 text-emerald-500 mb-2" />
            <Badge variant="secondary" className="mb-2 text-[10px] h-5 px-1.5 pointer-events-none">
                SECTOR
            </Badge>
            <span className="text-sm font-bold text-stone-100 line-clamp-2 leading-tight">
                {info.sector || "Unknown"}
            </span>
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">
                {info.description || "No description available."}
                </p>
            </div>
        </div>

        {/* Analyst Analysis Section */}
        {info.analyst && (
            <div className="mt-2 pt-6 border-t border-white/5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Analyst Analysis
                </h3>

                <p className="text-sm text-stone-300 mb-6 italic">
                    {info.analyst.summary}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Consensus Card */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                        <span className="text-xs text-stone-400 mb-2 uppercase tracking-wider">Consensus</span>
                        <div className={cn(
                            "text-2xl font-bold",
                            info.analyst.consensus.toLowerCase().includes('buy') ? "text-emerald-400" :
                            info.analyst.consensus.toLowerCase().includes('sell') ? "text-rose-400" :
                            "text-amber-400"
                        )}>
                            {info.analyst.consensus}
                        </div>
                    </div>

                    {/* Price Target Card */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                         <span className="text-xs text-stone-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                             <Target className="w-3 h-3" />
                             Price Target
                         </span>
                         <div className="text-2xl font-bold text-white">
                             {info.analyst.targetPrice ? `$${info.analyst.targetPrice.toFixed(2)}` : 'N/A'}
                         </div>
                         {info.analyst.targetUpside !== null && (
                             <div className={cn(
                                 "text-xs font-medium mt-1",
                                 info.analyst.targetUpside >= 0 ? "text-emerald-400" : "text-rose-400"
                             )}>
                                 {info.analyst.targetUpside >= 0 ? '+' : ''}{info.analyst.targetUpside.toFixed(2)}% upside
                             </div>
                         )}
                    </div>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  )
}

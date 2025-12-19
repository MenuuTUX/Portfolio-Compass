"use client"

import * as React from "react"
import { Layers, AlertCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface StockInfo {
  sector: string
  industry: string
  description: string
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
        <CardContent className="flex flex-col sm:flex-row gap-6">
          {/* Sector Square Skeleton */}
          <Skeleton className="h-32 w-32 shrink-0 rounded-lg" />
          {/* Description Skeleton */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
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
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>Asset Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-6">
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
           <div className="max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
             <p className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">
               {info.description || "No description available."}
             </p>
           </div>
        </div>
      </CardContent>
    </Card>
  )
}

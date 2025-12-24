"use client"

import * as React from "react"
import { Layers, AlertCircle, TrendingUp, Target } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"

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
  marketCap?: number
  revenue?: number
  netIncome?: number
  sharesOutstanding?: number
  eps?: number
  peRatio?: number
  forwardPe?: number
  dividend?: number
  dividendYield?: number
  exDividendDate?: string
  volume?: number
  open?: number
  previousClose?: number
  daysRange?: string
  fiftyTwoWeekRange?: string
  beta?: number
  earningsDate?: string
  fiftyTwoWeekLow?: number
  fiftyTwoWeekHigh?: number
  expenseRatio?: number
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

function formatLargeNumber(num: number | undefined): string {
    if (num === undefined) return 'n/a';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
}

function formatNumber(num: number | undefined, decimals = 2): string {
    if (num === undefined) return 'n/a';
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
          <div className="grid grid-cols-2 gap-4">
               <Skeleton className="h-8 w-full" />
               <Skeleton className="h-8 w-full" />
               <Skeleton className="h-8 w-full" />
               <Skeleton className="h-8 w-full" />
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
            <div className="flex flex-col items-center justify-center h-28 w-28 shrink-0 rounded-lg bg-stone-800/50 p-2 text-center border border-white/5 shadow-inner">
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

        {/* Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-6 border-t border-white/5">
            {/* Left Column */}
            <div className="space-y-4">
                <Row label="Market Cap" value={formatLargeNumber(info.marketCap)} />
                <Row label="Revenue (ttm)" value={formatLargeNumber(info.revenue)} />
                <Row label="Net Income (ttm)" value={formatLargeNumber(info.netIncome)} />
                <Row label="Shares Out" value={formatLargeNumber(info.sharesOutstanding)} />
                <Row label="EPS (ttm)" value={formatNumber(info.eps)} />
                <Row label="PE Ratio" value={formatNumber(info.peRatio)} />
                <Row label="Forward PE" value={formatNumber(info.forwardPe)} />
                <Row label="Dividend" value={info.dividend ? `${formatCurrency(info.dividend)}` : 'n/a'} />
                <Row label="Dividend Yield" value={info.dividendYield ? `${info.dividendYield.toFixed(2)}%` : 'n/a'} />
                <Row label="Ex-Dividend Date" value={info.exDividendDate || 'n/a'} />
            </div>

            {/* Right Column */}
            <div className="space-y-4">
                <Row label="Volume" value={info.volume?.toLocaleString() || 'n/a'} />
                <Row label="Open" value={formatNumber(info.open, 4)} />
                <Row label="Previous Close" value={formatNumber(info.previousClose, 4)} />
                <Row label="Day's Range" value={info.daysRange || 'n/a'} />
                <Row label="52-Week Range" value={info.fiftyTwoWeekRange || 'n/a'} />
                <Row label="Beta" value={formatNumber(info.beta)} />
                <Row label="Analysts" value={info.analyst?.consensus || 'n/a'} />
                <Row label="Price Target" value={info.analyst?.targetPrice ? `$${formatNumber(info.analyst.targetPrice)}` : 'n/a'} />
                <Row label="Earnings Date" value={info.earningsDate || 'n/a'} />
            </div>
        </div>

        {/* Analyst Analysis Text */}
        {info.analyst?.summary && (
            <div className="pt-6 border-t border-white/5">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Analyst Summary
                </h3>
                <p className="text-sm text-stone-300 italic">
                    {info.analyst.summary}
                </p>
            </div>
        )}

      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <span className="text-sm text-stone-400 font-medium hover:underline decoration-dotted decoration-stone-600 underline-offset-4 cursor-default" title={label}>{label}</span>
            <span className="text-sm font-mono text-stone-100">{value}</span>
        </div>
    )
}

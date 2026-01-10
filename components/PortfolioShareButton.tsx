"use client";

import { useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { toPng } from "html-to-image";
import { PortfolioShareCard, ShareCardProps } from "./PortfolioShareCard";

interface PortfolioShareButtonProps {
  portfolio: ShareCardProps["portfolio"];
  metrics: ShareCardProps["metrics"];
  history: {
    date: string;
    value: number;
    dividendValue?: number;
    min?: number;
    max?: number;
  }[];
}

export function PortfolioShareButton({
  portfolio,
  metrics,
  history,
}: PortfolioShareButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById("portfolio-share-card");
      if (!element) return;

      // 1. Generate PNG
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#0a0a0a", // stone-950
        pixelRatio: 2, // High res
      });

      // 2. Trigger Download
      const link = document.createElement("a");
      link.download = `portfolio-compass-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();

      // 3. Success State
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={isGenerating || isSuccess}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {isGenerating ? "Generating..." : isSuccess ? "Saved!" : "Export Card"}
      </button>

      {/* Hidden Render Container */}
      <div className="fixed left-[-9999px] top-[-9999px]">
        <div id="portfolio-share-card">
          <PortfolioShareCard
            portfolio={portfolio}
            metrics={metrics}
            chartData={history}
          />
        </div>
      </div>
    </>
  );
}

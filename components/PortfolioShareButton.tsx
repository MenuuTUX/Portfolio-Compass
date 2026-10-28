"use client";

import { useState } from "react";
import { Download, Loader2, Check } from "lucide-react";
import { toPng } from "html-to-image";
import { PortfolioShareCard, ShareCardProps } from "./PortfolioShareCard";

interface PortfolioShareButtonProps {
  portfolio: ShareCardProps["portfolio"];
  currency?: string;
  fxProvenance?: ShareCardProps["fxProvenance"];
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
  currency,
  fxProvenance,
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

      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#FAFAFA",
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `portfolio-compass-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();

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
        className="flex items-center gap-2 px-4 h-11 md:h-9 rounded-full bg-surface-soft text-ink hover:bg-hairline-strong transition-colors duration-75 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isSuccess ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        {isGenerating
          ? "Generating..."
          : isSuccess
            ? "Saved"
            : "Export snapshot"}
      </button>

      {/* Hidden Render Container */}
      <div className="fixed left-[-9999px] top-[-9999px]">
        <div id="portfolio-share-card">
          <PortfolioShareCard
            portfolio={portfolio}
            currency={currency}
            fxProvenance={fxProvenance}
            metrics={metrics}
            chartData={history}
          />
        </div>
      </div>
    </>
  );
}

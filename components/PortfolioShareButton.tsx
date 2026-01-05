"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  Download,
  X,
  Loader2,
  Eye,
  ExternalLink,
  Settings2,
} from "lucide-react";
import { toPng } from "html-to-image";
import { PortfolioShareCard, ShareCardProps } from "./PortfolioShareCard";
import { encodePortfolioData } from "@/lib/steganography";

interface PortfolioShareButtonProps {
  portfolio: ShareCardProps["portfolio"];
  metrics: ShareCardProps["metrics"];
  chartData: ShareCardProps["chartData"];
  spyData?: ShareCardProps["spyData"];
  disabled?: boolean;
}

export function PortfolioShareButton({
  portfolio,
  metrics,
  chartData,
  spyData,
  disabled,
}: PortfolioShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [userName, setUserName] = useState("");
  const [portfolioName, setPortfolioName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateImage = async () => {
    if (!cardRef.current) return null;
    // Small delay to ensure render
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 1. Generate visual PNG
    const baseDataUrl = await toPng(cardRef.current, {
      cacheBust: true,
      backgroundColor: "#0a0a0a",
      quality: 1.0,
      pixelRatio: 2, // High res
    });

    // 2. Encode hidden data
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);

          // Prepare payload
          const payload = {
            type: "PORTFOLIO_COMPASS_V1",
            portfolio,
            meta: {
              name: portfolioName,
              user: userName,
              date: new Date().toISOString(),
            },
          };

          try {
            const finalDataUrl = await encodePortfolioData(canvas, payload);
            resolve(finalDataUrl);
          } catch (e) {
            console.error("Steganography encoding failed", e);
            // Fallback to base image if encoding fails
            resolve(baseDataUrl);
          }
        } else {
          resolve(baseDataUrl);
        }
      };
      img.onerror = reject;
      img.src = baseDataUrl;
    });
  };

  const handleDownload = useCallback(async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;

      const link = document.createElement("a");
      link.download = `portfolio-compass-${(portfolioName || "report").replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();

      setShowModal(false);
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setIsGenerating(false);
    }
  }, [portfolioName, portfolio, userName]);

  const handleNativeShare = useCallback(async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `portfolio-compass-report.png`, {
        type: blob.type,
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Portfolio Compass Report",
          text: `Check out my ${portfolioName || "Investment"} portfolio analysis on Portfolio Compass.`,
          files: [file],
        });
      } else {
        alert(
          "Your browser doesn't support direct image sharing. Please download instead.",
        );
      }
    } catch (err) {
      console.error("Share failed", err);
    } finally {
      setIsGenerating(false);
    }
  }, [portfolioName, portfolio, userName]);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 border border-emerald-500/30 text-emerald-100 rounded-xl font-medium transition-all shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
        Get Report Card
      </button>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-6xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[95vh]"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-white/20 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* PREVIEW COLUMN */}
              <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-8 min-h-[550px] overflow-hidden order-1 md:order-1 border-r border-white/5">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.05]" />

                {/* Preview Header */}
                <div className="absolute top-6 left-8 flex items-center gap-2 text-neutral-500 text-sm font-medium z-10">
                  <Eye className="w-4 h-4" /> Preview Mode
                </div>

                {/* Scale container to fit the large card into the view - ABSOLUTE to prevent layout flow expansion */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none pb-12">
                  <div className="transform scale-[0.36] lg:scale-[0.36] origin-center shadow-2xl shadow-black border border-white/10 rounded-[40px] overflow-hidden pointer-events-auto ring-1 ring-white/5">
                    {/* This is the LIVE rendered card used for both preview and generation */}
                    <PortfolioShareCard
                      ref={cardRef}
                      userName={userName}
                      portfolioName={portfolioName}
                      portfolio={portfolio}
                      metrics={metrics}
                      chartData={chartData}
                      spyData={spyData}
                    />
                  </div>
                </div>
                <div className="absolute bottom-6 left-0 w-full text-center text-xs text-neutral-600 font-mono pointer-events-none uppercase tracking-wider z-20">
                  Dimensions: 1080 x 1350px (Social Portrait) • Biopunk Encoding
                  Active
                </div>
              </div>

              {/* CONTROLS COLUMN */}
              <div className="w-full md:w-[420px] bg-[#0f0f0f] p-8 flex flex-col shrink-0 relative z-10 order-2 md:order-2">
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Settings2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      Report Settings
                    </h3>
                  </div>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Customize the header details for your institutional-grade
                    portfolio report. Hidden biometric data will be embedded.
                  </p>
                </div>

                <div className="space-y-8 flex-1">
                  <div className="space-y-5">
                    <div className="group">
                      <label className="block text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2.5">
                        Portfolio Title
                      </label>
                      <input
                        type="text"
                        value={portfolioName}
                        onChange={(e) => setPortfolioName(e.target.value)}
                        placeholder="Growth Strategy A"
                        maxLength={30}
                        className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-4 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-neutral-700 text-sm font-medium"
                      />
                    </div>

                    <div className="group">
                      <label className="block text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2.5">
                        Investor Name
                      </label>
                      <input
                        type="text"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="J. Smith"
                        maxLength={24}
                        className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-4 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-neutral-700 text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-900/50 border border-white/5 text-sm text-neutral-400 leading-relaxed">
                    <p className="mb-2 font-bold text-white flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-emerald-500" /> Community
                    </p>
                    Share this report on{" "}
                    <a
                      href="https://www.reddit.com/r/investing/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      r/investing
                    </a>{" "}
                    or{" "}
                    <a
                      href="https://www.reddit.com/r/Etf/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      r/Etf
                    </a>
                    .
                  </div>
                </div>

                <div className="mt-10 space-y-4 pt-8 border-t border-white/5">
                  <button
                    onClick={handleNativeShare}
                    disabled={isGenerating}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ExternalLink className="w-5 h-5" />
                    )}
                    Share Report Directly
                  </button>

                  <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="w-full py-4 bg-[#161616] hover:bg-[#202020] text-white border border-white/10 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    Download PNG Image
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

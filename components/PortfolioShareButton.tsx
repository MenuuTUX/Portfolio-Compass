'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, X, Loader2, Eye, ExternalLink } from 'lucide-react';
import { toPng } from 'html-to-image';
import { PortfolioShareCard, ShareCardProps } from './PortfolioShareCard';

interface PortfolioShareButtonProps {
  portfolio: ShareCardProps['portfolio'];
  metrics: ShareCardProps['metrics'];
  chartData: ShareCardProps['chartData'];
  disabled?: boolean;
}

export function PortfolioShareButton({ portfolio, metrics, chartData, disabled }: PortfolioShareButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateImage = async () => {
    if (!cardRef.current) return null;
    // Small delay to ensure render
    await new Promise(resolve => setTimeout(resolve, 100));

    return await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#050505',
        quality: 1.0,
        pixelRatio: 2 // High res
    });
  };

  const handleDownload = useCallback(async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;

      const link = document.createElement('a');
      link.download = `portfolio-compass-${portfolioName.replace(/\s+/g, '-').toLowerCase() || 'snapshot'}.png`;
      link.href = dataUrl;
      link.click();

      setShowModal(false);
    } catch (err) {
      console.error('Failed to generate image', err);
    } finally {
      setIsGenerating(false);
    }
  }, [portfolioName]);

  const handleNativeShare = useCallback(async () => {
      setIsGenerating(true);
      try {
          const dataUrl = await generateImage();
          if (!dataUrl) return;

          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], `portfolio-compass.png`, { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  title: 'My Portfolio Compass Analysis',
                  text: `Check out my ${portfolioName || 'Growth'} portfolio analysis on Portfolio Compass!`,
                  files: [file]
              });
          } else {
              // Fallback if sharing files isn't supported but text is (unlikely for this flow, but safe)
               alert("Your browser doesn't support direct image sharing. Please download instead.");
          }
      } catch (err) {
          console.error("Share failed", err);
      } finally {
          setIsGenerating(false);
      }
  }, [portfolioName]);

  return (
    <>
      <button
         onClick={() => setShowModal(true)}
         disabled={disabled}
         className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 border border-emerald-500/30 text-emerald-100 rounded-xl font-medium transition-all shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed group"
      >
         <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
         Get Portfolio Info Card
      </button>

      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl relative flex flex-col md:flex-row overflow-hidden max-h-[90vh]"
                >
                    <button
                        onClick={() => setShowModal(false)}
                        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-white/20 text-neutral-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* PREVIEW COLUMN */}
                    <div className="flex-1 bg-[#050505] relative flex items-center justify-center p-8 min-h-[400px] md:min-h-full overflow-hidden order-1 md:order-1">
                         <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.05]" />

                         {/* Scale container to fit the large card into the view - ABSOLUTE to prevent layout flow expansion */}
                         <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                            <div className="transform scale-[0.35] md:scale-[0.45] origin-center shadow-2xl shadow-emerald-900/20 border border-white/5 rounded-xl overflow-hidden pointer-events-auto">
                                {/* This is the LIVE rendered card used for both preview and generation */}
                                <PortfolioShareCard
                                    ref={cardRef}
                                    userName={userName}
                                    portfolioName={portfolioName}
                                    portfolio={portfolio}
                                    metrics={metrics}
                                    chartData={chartData}
                                />
                            </div>
                         </div>
                         <div className="absolute bottom-4 left-0 w-full text-center text-xs text-neutral-500 pointer-events-none">
                            Preview (1080 x 1350px)
                         </div>
                    </div>

                    {/* CONTROLS COLUMN */}
                    <div className="w-full md:w-[400px] bg-[#111] p-8 flex flex-col border-l border-white/10 shrink-0 relative z-10 order-2 md:order-2">
                        <div className="mb-8">
                            <h3 className="text-2xl font-bold text-white mb-2">Customize Card</h3>
                            <p className="text-neutral-400 text-sm">Edit the details below to personalize your portfolio snapshot.</p>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="block text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">Portfolio Name</label>
                                <input
                                    type="text"
                                    value={portfolioName}
                                    onChange={(e) => setPortfolioName(e.target.value)}
                                    placeholder="e.g. High Growth Tech"
                                    maxLength={24}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-neutral-600"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">Investor Name</label>
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="e.g. Alex Trader"
                                    maxLength={24}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-neutral-600"
                                />
                            </div>

                            <div className="p-4 rounded-lg bg-emerald-900/10 border border-emerald-500/20 text-sm text-neutral-300">
                                <p className="mb-2 font-medium text-emerald-400">Pro Tip:</p>
                                Share this on r/investing or r/etfs to get feedback on your allocation strategy!
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                             <button
                                onClick={handleNativeShare}
                                disabled={isGenerating}
                                className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
                                Share Directly
                            </button>

                            <button
                                onClick={handleDownload}
                                disabled={isGenerating}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                Download Image
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

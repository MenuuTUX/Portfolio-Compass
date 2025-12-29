'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Download, X, Loader2 } from 'lucide-react';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);

    try {
      // Small delay to ensure render
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#0a0a0a',
        quality: 1.0,
        pixelRatio: 2 // High res
      });

      const link = document.createElement('a');
      link.download = `portfolio-compass-${userName || 'snapshot'}.png`;
      link.href = dataUrl;
      link.click();

      setShowModal(false);
    } catch (err) {
      console.error('Failed to generate image', err);
    } finally {
      setIsGenerating(false);
    }
  }, [userName]);

  return (
    <>
      <button
         onClick={() => setShowModal(true)}
         disabled={disabled}
         className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
         <Share2 className="w-4 h-4" />
         Share
      </button>

      <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative"
                >
                    <button
                        onClick={() => setShowModal(false)}
                        className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <h3 className="text-xl font-bold text-white mb-2">Share Portfolio</h3>
                    <p className="text-neutral-400 text-sm mb-6">Create a snapshot of your current projection.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-neutral-500 uppercase mb-2">Investor Name (Optional)</label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                            />
                        </div>

                        <button
                            onClick={handleDownload}
                            disabled={isGenerating}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isGenerating ? 'Generating...' : 'Download Snapshot'}
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Hidden Render Container */}
      {showModal && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
             <PortfolioShareCard
                ref={cardRef}
                userName={userName}
                portfolio={portfolio}
                metrics={metrics}
                chartData={chartData}
             />
        </div>
      )}
    </>
  );
}

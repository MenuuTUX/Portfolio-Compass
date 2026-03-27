"use client";

import { motion } from "framer-motion";
import { Star, X, Github, Heart } from "lucide-react";
import { useEffect } from "react";

interface ContributePopupProps {
  onClose: () => void;
}

export default function ContributePopup({ onClose }: ContributePopupProps) {
  // Prevent scrolling when popup is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-[#0a0a0a] border border-amber-500/30 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]"
      >
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative p-6 md:p-8 flex flex-col items-center text-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-neutral-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="mb-6 relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full" />
            <div className="relative w-16 h-16 rounded-full bg-amber-950/50 border border-amber-500/30 flex items-center justify-center">
              <Star className="w-8 h-8 text-amber-400 fill-amber-400/20" />
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2 font-space">
            Enjoying Portfolio Compass?
          </h3>
          <p className="text-neutral-400 mb-8 max-w-xs mx-auto">
            If you find this tool helpful, consider starring the repository on
            GitHub. It helps us grow!
          </p>

          <div className="flex flex-col gap-3 w-full">
            <a
              href="https://github.com/Shib-Das/Portfolio-Compass"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] group"
              onClick={onClose}
            >
              <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Star on GitHub</span>
            </a>

            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 font-medium transition-colors cursor-pointer"
            >
              <span>Maybe Later</span>
            </button>
          </div>

          <div className="mt-6 text-xs text-neutral-500 flex items-center gap-1.5">
            <span>Made with</span>
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
            <span>for investors</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

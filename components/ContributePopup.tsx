"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star, X, Github } from "lucide-react";
import { useEffect } from "react";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface ContributePopupProps {
  onClose: () => void;
}

export default function ContributePopup({ onClose }: ContributePopupProps) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);
  const reduceMotion = useReducedMotion();
  // Prevent scrolling when popup is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contribute-popup-title"
    >
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface-card ring-1 ring-hairline shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
      >
        <div className="relative p-6 md:p-8 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={onClose}
            className="ws-icon-btn absolute top-3 right-3"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-surface-soft">
            <Star className="w-6 h-6 text-ink" aria-hidden />
          </div>

          <h3 id="contribute-popup-title" className="text-xl font-semibold text-ink mb-2">
            Using Portfolio Compass?
          </h3>
          <p className="text-sm text-body mb-8 max-w-xs mx-auto">
            A GitHub star helps more people find the project.
          </p>

          <div className="flex flex-col gap-2 w-full">
            <a
              href="https://github.com/MenuuTUX/Portfolio-Compass"
              target="_blank"
              rel="noopener noreferrer"
              className="ws-pill ws-pill-primary w-full"
              onClick={onClose}
            >
              <Github className="w-4 h-4" aria-hidden />
              <span>Star on GitHub</span>
            </a>

            <button type="button" onClick={onClose} className="ws-pill w-full">
              Not now
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

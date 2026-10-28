"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useDialogA11y } from "@/hooks/useDialogA11y";

interface MessageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "error" | "success" | "info";
}

export default function MessageDrawer({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
}: MessageDrawerProps) {
  const dialogRef = useDialogA11y<HTMLDivElement>(isOpen, onClose);
  const reduceMotion = useReducedMotion();
  const tone =
    type === "error" ? "text-rose-400" : type === "success" ? "text-emerald-400" : "text-muted";
  const Icon = type === "error" ? AlertTriangle : type === "success" ? CheckCircle : Info;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-drawer-title"
            key="drawer"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="app-sheet-safe fixed bottom-0 left-0 right-0 mx-auto max-w-lg max-h-[70vh] bg-surface-card ring-1 ring-hairline rounded-t-2xl z-50 overflow-y-auto shadow-[0_-24px_64px_rgba(0,0,0,0.45)]"
          >
            <RevealGroup stagger={0.05} delay={0.08} onMount>
            <RevealItem y={8} duration={0.4}>
            <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${tone}`} aria-hidden />
                <h2 id="message-drawer-title" className="text-base font-semibold text-ink">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ws-icon-btn -mr-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            </RevealItem>

            <RevealItem y={8} duration={0.4}>
            <div className="px-6 pb-2">
              <p className="text-sm leading-6 text-body mb-6">{message}</p>
              <button type="button" onClick={onClose} className="ws-pill ws-pill-primary w-full">
                Go back
              </button>
            </div>
            </RevealItem>
            </RevealGroup>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

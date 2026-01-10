"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PortfolioItem } from "@/types";
import { cn } from "@/lib/utils";

interface ImportPortfolioCardProps {
  onImport: (portfolio: PortfolioItem[]) => void;
  className?: string;
}

export default function ImportPortfolioCard({
  onImport,
  className,
}: ImportPortfolioCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Feature temporarily disabled as steganography lib was removed.
    // In a real app, we might just parse a JSON file or similar.
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatus("error");
    setErrorMessage("Import feature is currently disabled.");
    setTimeout(() => {
        setStatus("idle");
        setIsProcessing(false);
    }, 3000);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={cn("relative h-full", className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg"
        className="hidden"
      />

      <motion.button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full h-full bg-stone-950/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 group overflow-hidden text-center relative hover:border-emerald-500/50 transition-colors",
          status === "error" && "border-rose-500/50",
        )}
      >
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {isProcessing ? (
          <div className="relative z-10 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <span className="text-sm text-stone-400">Processing...</span>
          </div>
        ) : status === "success" ? (
          <div className="relative z-10 flex flex-col items-center gap-3">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center"
            >
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </motion.div>
            <span className="text-lg font-bold text-emerald-400">
              Imported!
            </span>
          </div>
        ) : (
          <>
            <div className="relative z-10 w-16 h-16 rounded-2xl bg-stone-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xl group-hover:shadow-emerald-500/20">
              <Upload className="w-8 h-8 text-stone-400 group-hover:text-emerald-400 transition-colors" />
            </div>

            <div className="relative z-10 space-y-1">
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Import Portfolio
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-[200px] mx-auto">
                Upload a Portfolio Compass image to instantly import it.
              </p>
            </div>
          </>
        )}
      </motion.button>

      {/* Error Message */}
      <AnimatePresence>
        {status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-4 right-4 bg-rose-950/90 border border-rose-500/30 text-rose-200 text-xs p-3 rounded-lg backdrop-blur-md text-center shadow-lg pointer-events-none"
          >
            <AlertCircle className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

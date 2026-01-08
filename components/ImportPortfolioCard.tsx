"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  AlertCircle,
  Smartphone,
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
  // Steganography removed. This component is now a placeholder or needs new logic.
  // For now, we will disable the functionality but keep the UI structure to avoid breaking layout.

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      // Feature disabled
      setStatus("error");
      setErrorMessage("Import from image is currently disabled.");
      setTimeout(() => setStatus("idle"), 5000);
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

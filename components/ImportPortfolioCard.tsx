import { ImageOff } from "lucide-react";
import { PortfolioItem } from "@/types";
import { cn } from "@/lib/utils";

interface ImportPortfolioCardProps {
  onImport: (portfolio: PortfolioItem[]) => void;
  className?: string;
}

export default function ImportPortfolioCard({
  className,
}: ImportPortfolioCardProps) {
  return (
    <div
      className={cn(
        "w-full h-full bg-stone-950/80 border border-hairline rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center",
        className,
      )}
      aria-disabled="true"
    >
      <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-hairline flex items-center justify-center">
        <ImageOff className="w-8 h-8 text-stone-500" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-ink">
          Image Import Unavailable
        </h3>
        <p className="text-xs text-stone-500 leading-relaxed max-w-[220px] mx-auto">
          Portfolio images can be exported, but importing them is not
          implemented.
        </p>
      </div>
    </div>
  );
}

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
        "w-full bg-surface-card ring-1 ring-hairline rounded-2xl px-4 py-3 flex items-center gap-3",
        className,
      )}
      aria-disabled="true"
    >
      <div className="w-10 h-10 rounded-xl bg-surface-soft flex items-center justify-center shrink-0">
        <ImageOff className="w-5 h-5 text-muted" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-ink">Image import unavailable</h3>
        <p className="text-xs text-muted leading-relaxed">
          Portfolio images can be exported, but importing them is not
          implemented.
        </p>
      </div>
    </div>
  );
}

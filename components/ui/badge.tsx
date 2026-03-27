import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2",
          // Default variants mapped to theme colors
          variant === "default" &&
            "border-transparent bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
          variant === "secondary" &&
            "border-transparent bg-neutral-800 text-neutral-100 hover:bg-neutral-800/80",
          variant === "destructive" &&
            "border-transparent bg-red-500/10 text-red-500 hover:bg-red-500/20",
          variant === "outline" && "text-neutral-100",
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge };

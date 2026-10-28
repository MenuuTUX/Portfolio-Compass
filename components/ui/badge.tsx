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
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass",
          // Default variants mapped to theme colors
          variant === "default" &&
            "border-transparent bg-emerald-400/10 text-emerald-400",
          variant === "secondary" &&
            "border-transparent bg-surface-soft text-body-strong",
          variant === "destructive" &&
            "border-transparent bg-red-400/10 text-red-400",
          variant === "outline" && "border-hairline-strong text-body-strong",
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge };

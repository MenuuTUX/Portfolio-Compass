"use client";

import { cn } from "@/lib/cn";

/**
 * Skeleton block with a slow horizontal shimmer sweep (1.6s), driven by the
 * `.ws-skeleton` CSS class. The class turns the sweep off for reduced-motion users.
 */
export default function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("ws-skeleton rounded", className)} />;
}

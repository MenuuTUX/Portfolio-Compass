import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

/** Skeleton with the smaller corner radius, for dense rows. */
export default function Shimmer({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded", className)} />;
}

import { cn } from "@/lib/cn";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("ws-skeleton rounded-lg", className)} {...props} />;
}

export { Skeleton };

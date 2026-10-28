import type { ReactNode } from "react";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface PageHeaderProps {
  /** Right-aligned actions, normally .ws-pill buttons. */
  children?: ReactNode;
}

export default function PageHeader({ children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <p className="text-sm font-bold text-ink" suppressHydrationWarning>
        {greeting()}
      </p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

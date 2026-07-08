"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 border border-hairline rounded-full p-1 bg-surface-card/50 backdrop-blur-sm h-[34px] w-[106px]" />
    );
  }

  const options = [
    { value: "light", label: "Light mode", Icon: Sun },
    { value: "system", label: "System default", Icon: Monitor },
    { value: "dark", label: "Dark mode", Icon: Moon },
  ] as const;

  return (
    <div className="flex items-center gap-1 border border-hairline rounded-full p-1 bg-surface-card/50 backdrop-blur-sm">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "p-1.5 rounded-full transition-all",
            theme === value
              ? "bg-surface-soft text-ink shadow-sm"
              : "text-muted hover:text-ink hover:bg-surface-soft/50",
          )}
          aria-label={label}
          title={label}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

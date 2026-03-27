"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 border border-neutral-800 rounded-full p-1 bg-neutral-950/50 backdrop-blur-sm h-[34px] w-[106px]" />
    );
  }

  return (
    <div className="flex items-center gap-1 border border-border rounded-full p-1 bg-background/50 backdrop-blur-sm">
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-full transition-all ${
          theme === "light"
            ? "bg-accent text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
        aria-label="Light mode"
        title="Light Mode"
      >
        <Sun size={14} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-full transition-all ${
          theme === "system"
            ? "bg-accent text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
        aria-label="System mode"
        title="System Default"
      >
        <Monitor size={14} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-full transition-all ${
          theme === "dark"
            ? "bg-accent text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
        aria-label="Dark mode"
        title="Dark Mode"
      >
        <Moon size={14} />
      </button>
    </div>
  );
}

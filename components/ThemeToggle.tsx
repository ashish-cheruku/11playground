"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "elp-theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const cur = document.documentElement.getAttribute("data-theme");
  if (cur === "dark" || cur === "light") return cur;
  return "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Start as null until mount, then sync from <html data-theme>.
  // The bootstrap script in layout.tsx already set the attribute correctly.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  // Render a spacer with the same dimensions while we wait for mount,
  // so the sidebar layout doesn't jump on hydration.
  if (theme === null) {
    return <div className={`w-8 h-8 ${className}`} aria-hidden />;
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-text hover:bg-panel2 transition-colors ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4" strokeWidth={1.75} />
      ) : (
        <Moon className="w-4 h-4" strokeWidth={1.75} />
      )}
    </button>
  );
}

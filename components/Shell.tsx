"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

export function Shell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer when the route changes (clicked a nav link)
  // — uses bubbling click to detect any internal <a> click.
  // Also close on Esc.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar — hidden on md+ */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center px-3 gap-2 border-b border-border bg-panel/95 backdrop-blur supports-[backdrop-filter]:bg-panel/80">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="w-10 h-10 -ml-1 rounded-md flex items-center justify-center text-text hover:bg-panel2 active:bg-panel2 transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <Link href="/" className="flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-tight leading-tight">ElevenLabs</div>
          <div className="text-[10px] text-muted leading-tight">Playground · v0.1</div>
        </Link>
        <ThemeToggle />
      </header>

      {/* Mobile drawer backdrop */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      {/* Sidebar — slide-in drawer on mobile, static column on md+ */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out md:transform-none ${
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Close button inside drawer (mobile only) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation"
          className="md:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-md flex items-center justify-center text-muted hover:text-text hover:bg-panel2 transition-colors"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>

        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>

      {/* Main — top padding on mobile reserves space for the fixed header */}
      <main className="flex-1 min-h-screen min-w-0 pt-14 md:pt-0">{children}</main>
    </div>
  );
}

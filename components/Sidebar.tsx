"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Mic,
  MessagesSquare,
  Volume2,
  Library,
  Dna,
  Sparkles,
  Repeat,
  FileText,
  BookOpen,
  Scale,
  History,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  { group: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Generate",
    items: [
      { href: "/tts", label: "Text to Speech", icon: Mic },
      { href: "/dialogue", label: "Text to Dialogue", icon: MessagesSquare },
      { href: "/sound-effects", label: "Sound Effects", icon: Volume2 },
    ],
  },
  {
    group: "Voices",
    items: [
      { href: "/voices", label: "Voice Library", icon: Library },
      { href: "/voice-clone", label: "Voice Cloning", icon: Dna },
      { href: "/voice-design", label: "Voice Design", icon: Sparkles },
      { href: "/voice-changer", label: "Voice Changer (S2S)", icon: Repeat },
    ],
  },
  {
    group: "Audio",
    items: [
      { href: "/stt", label: "Speech to Text", icon: FileText },
      { href: "/pronunciation", label: "Pronunciation Dict", icon: BookOpen },
    ],
  },
  {
    group: "Research",
    items: [
      { href: "/ab-test", label: "A/B Compare", icon: Scale },
      { href: "/history", label: "History", icon: History },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-panel min-h-screen flex flex-col">
      <div className="px-4 py-5 border-b border-border flex items-start justify-between gap-3">
        <Link href="/" className="block min-w-0">
          <div className="text-base font-semibold tracking-tight">ElevenLabs</div>
          <div className="text-xs text-muted">Playground · v0.1</div>
        </Link>
        <ThemeToggle className="shrink-0 -mr-1" />
      </div>
      <nav className="flex-1 overflow-y-auto scroll-thin py-2">
        {NAV.map((group) => (
          <div key={group.group} className="mb-3">
            <div className="px-4 pt-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted font-semibold">
              {group.group}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                    active ? "bg-accent/15 text-accent border-r-2 border-accent" : "text-text hover:bg-panel2"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border text-[11px] text-muted">
        <div>API key in localStorage</div>
        <div>Direct browser → ElevenLabs</div>
      </div>
    </aside>
  );
}

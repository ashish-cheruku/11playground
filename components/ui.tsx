"use client";

import { clsx } from "clsx";
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type HTMLAttributes, forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "outline" }>(
  function Button({ variant = "primary", className, ...props }, ref) {
    const styles = {
      primary: "bg-accent hover:bg-accent/90 text-white",
      ghost: "bg-transparent hover:bg-panel2 text-text",
      danger: "bg-danger hover:bg-danger/90 text-white",
      outline: "bg-transparent border border-border hover:bg-panel2 text-text",
    }[variant];
    return (
      <button
        ref={ref}
        className={clsx(
          "px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          styles,
          className
        )}
        {...props}
      />
    );
  }
);

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full px-3 py-2 rounded-md bg-panel2 border border-border text-text text-sm",
        "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(
          "w-full px-3 py-2 rounded-md bg-panel2 border border-border text-text text-sm font-mono",
          "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y",
          className
        )}
        {...props}
      />
    );
  }
);

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full px-3 py-2 rounded-md bg-panel2 border border-border text-text text-sm",
        "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("bg-panel border border-border rounded-lg p-4", className)} {...props} />
  );
}

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={clsx("block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide", className)}>{children}</label>;
}

export function Badge({ children, color = "accent" }: { children: React.ReactNode; color?: "accent" | "success" | "warn" | "danger" | "muted" }) {
  const colors = {
    accent: "bg-accent/10 text-accent border-accent/20",
    success: "bg-success/10 text-success border-success/20",
    warn: "bg-warn/10 text-warn border-warn/20",
    danger: "bg-danger/10 text-danger border-danger/20",
    muted: "bg-muted/10 text-muted border-muted/20",
  }[color];
  return <span className={clsx("inline-block px-2 py-0.5 text-xs rounded border", colors)}>{children}</span>;
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  hint,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>
        <span className="text-xs font-mono text-text">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-muted text-sm py-8">{children}</div>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin inline-block">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" />
    </svg>
  );
}

export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="bg-danger/10 border border-danger/30 rounded-md p-3 text-sm text-danger break-words">
      {msg}
    </div>
  );
}

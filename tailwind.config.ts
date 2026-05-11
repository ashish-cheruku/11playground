import type { Config } from "tailwindcss";

// Colors point to CSS variables defined in app/globals.css.
// :root holds the light palette; [data-theme="dark"] overrides for dark.
// Switching themes is a single attribute change on <html>.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "var(--color-bg)",
        panel:   "var(--color-panel)",
        panel2:  "var(--color-panel2)",
        border:  "var(--color-border)",
        muted:   "var(--color-muted)",
        text:    "var(--color-text)",
        accent:  "var(--color-accent)",
        accent2: "var(--color-accent2)",
        success: "var(--color-success)",
        danger:  "var(--color-danger)",
        warn:    "var(--color-warn)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

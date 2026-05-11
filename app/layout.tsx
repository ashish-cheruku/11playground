import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { ApiKeyGate } from "@/components/ApiKeyGate";

export const metadata: Metadata = {
  title: "ElevenLabs Playground",
  description: "Test every ElevenLabs feature with custom inputs and A/B comparison.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Inline script — runs synchronously before the page paints to set the
// data-theme attribute from localStorage. Prevents the light flash that
// otherwise happens when a user has dark theme saved but :root is light.
const themeBootstrap = `
(function() {
  try {
    var saved = localStorage.getItem('elp-theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-bg text-text font-sans antialiased">
        <ApiKeyGate>
          <Shell>{children}</Shell>
        </ApiKeyGate>
      </body>
    </html>
  );
}

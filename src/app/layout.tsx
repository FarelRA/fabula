import type { Metadata, Viewport } from "next";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Fabula · Direct an all-AI cast",
    template: "%s · Fabula",
  },
  description:
    "Direct an all-AI cast. Realtime roleplay where every path branches and nothing is destroyed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0d11" },
    { media: "(prefers-color-scheme: light)", color: "#f7f2e8" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

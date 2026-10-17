import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabula",
  description:
    "Direct an all-AI cast. Realtime roleplay where every path branches and nothing is destroyed.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-stage-950 font-sans text-parchment antialiased">
        {children}
      </body>
    </html>
  );
}

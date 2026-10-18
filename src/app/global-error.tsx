"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: the root layout itself failed, so this
 * renders its own document with inline styles, it cannot rely on globals.css
 * or any provider. Copy stays calm and honest: the data is server-side, only
 * the screen failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0f",
          color: "#f4f1ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ maxWidth: "28rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.1rem", fontWeight: 600 }}>
            Fabula hit an unexpected error
          </h1>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6, opacity: 0.8 }}>
            Your scenes and drafts are safe on the server. Reloading usually
            fixes this screen.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(244,241,234,0.3)",
              background: "transparent",
              color: "inherit",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

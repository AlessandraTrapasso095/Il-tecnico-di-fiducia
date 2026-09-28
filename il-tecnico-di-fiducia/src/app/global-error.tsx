"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", {
      name: error.name,
      message: error.message,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, Helvetica, sans-serif",
          background: "#f7f8fb",
          color: "#141b2c",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "560px",
              padding: "32px",
              borderRadius: "24px",
              background: "#ffffff",
              textAlign: "center",
              boxShadow: "0 8px 30px rgba(8,43,95,0.10)",
            }}
          >
            <h1
              style={{
                margin: 0,
                color: "#002654",
                fontSize: "32px",
                lineHeight: 1.15,
              }}
            >
              Il Tecnico di Fiducia
            </h1>

            <p
              style={{
                margin: "18px auto 0",
                maxWidth: "430px",
                lineHeight: 1.6,
              }}
            >
              Si è verificato un problema inatteso. Riprova tra qualche istante.
            </p>

            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "24px",
                minHeight: "48px",
                border: 0,
                borderRadius: "999px",
                padding: "0 24px",
                background: "#002654",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Riprova
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

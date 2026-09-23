import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("customer professional search feedback states", () => {
  it("marks the results section as busy while loading", () => {
    expect(source).toContain("aria-busy={professionalsLoading}");
  });

  it("shows an accessible visible loading state", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Ricerca in corso…");
    expect(source).toContain("progress_activity");
    expect(source).toContain("animate-spin");
  });

  it("prevents duplicate explicit search actions while loading", () => {
    expect(source).toContain("disabled={professionalsLoading}");
    expect(source).toContain("progress_activity");
    expect(source).toContain("Caricamento…");
    expect(source).not.toContain("Ricerca…");
    expect(source).not.toContain("Aggiornamento…");
  });

  it("announces professional search errors", () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain("Riprova");
  });

  it("gives an actionable empty state for active filters", () => {
    expect(source).toContain(
      "Prova a rimuovere uno o più filtri oppure azzerali per ampliare la ricerca.",
    );
    expect(source).toContain("Azzera filtri");
  });

  it("keeps recommended-results empty copy distinct from filtered search", () => {
    expect(source).toContain(
      "Al momento non ci sono professionisti consigliati disponibili nella tua zona.",
    );
  });
});

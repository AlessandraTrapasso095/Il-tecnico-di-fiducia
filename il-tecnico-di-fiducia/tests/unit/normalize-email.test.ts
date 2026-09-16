import { describe, expect, it } from "vitest";

import { normalizeEmail } from "@/lib/auth/normalize-email";

describe("normalizeEmail", () => {
  it("rimuove gli spazi esterni", () => {
    expect(normalizeEmail("  user@example.it  ")).toBe(
      "user@example.it",
    );
  });

  it("converte l'indirizzo in minuscolo", () => {
    expect(normalizeEmail("User@Example.IT")).toBe(
      "user@example.it",
    );
  });

  it("normalizza contemporaneamente spazi e maiuscole", () => {
    expect(normalizeEmail("  Alessandra@Example.IT ")).toBe(
      "alessandra@example.it",
    );
  });
});

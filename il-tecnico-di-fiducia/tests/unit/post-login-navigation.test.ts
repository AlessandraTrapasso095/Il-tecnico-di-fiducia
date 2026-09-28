import { describe, expect, it } from "vitest";

import {
  safeNextPathForRole,
  toPostLoginUrl,
} from "@/lib/auth/post-login-navigation";

describe("post-login navigation", () => {
  it("converte una destinazione interna in URL assoluto", () => {
    expect(toPostLoginUrl("/customer", "http://localhost:3002")).toBe(
      "http://localhost:3002/customer",
    );
  });

  it("preserva query string e stato della destinazione", () => {
    expect(
      toPostLoginUrl(
        "/customer?section=messages&conversation=abc",
        "http://localhost:3002",
      ),
    ).toBe("http://localhost:3002/customer?section=messages&conversation=abc");
  });

  it("consente il resume verso un profilo pubblico professionista", () => {
    expect(
      safeNextPathForRole("/professionisti/pro-123?action=contact", "customer"),
    ).toBe("/professionisti/pro-123?action=contact");
  });

  it("consente il resume nella dashboard del ruolo corretto", () => {
    expect(
      safeNextPathForRole(
        "/customer?section=messages&conversation=abc",
        "customer",
      ),
    ).toBe("/customer?section=messages&conversation=abc");

    expect(
      safeNextPathForRole("/professionista/messaggi", "professional"),
    ).toBe("/professionista/messaggi");
  });

  it("blocca destinazioni esterne", () => {
    expect(safeNextPathForRole("https://evil.example", "customer")).toBeNull();

    expect(safeNextPathForRole("//evil.example/path", "customer")).toBeNull();

    expect(
      safeNextPathForRole("\\\\evil.example\\path", "customer"),
    ).toBeNull();
  });

  it("blocca destinazioni appartenenti a un altro ruolo", () => {
    expect(
      safeNextPathForRole("/professionista/messaggi", "customer"),
    ).toBeNull();

    expect(safeNextPathForRole("/customer", "professional")).toBeNull();

    expect(safeNextPathForRole("/admin", "customer")).toBeNull();
  });
});

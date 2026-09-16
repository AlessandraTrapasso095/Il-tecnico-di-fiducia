import { describe, expect, it } from "vitest";

import { toPostLoginUrl } from "@/lib/auth/post-login-navigation";

describe("post-login navigation", () => {
  it("converte una destinazione interna in URL assoluto", () => {
    expect(
      toPostLoginUrl("/customer", "http://localhost:3002"),
    ).toBe("http://localhost:3002/customer");
  });

  it("preserva query string e stato della destinazione", () => {
    expect(
      toPostLoginUrl(
        "/customer?section=messages&conversation=abc",
        "http://localhost:3002",
      ),
    ).toBe(
      "http://localhost:3002/customer?section=messages&conversation=abc",
    );
  });
});

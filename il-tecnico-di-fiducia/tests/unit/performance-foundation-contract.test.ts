import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const searchPage = readFileSync("src/app/cerca/page.tsx", "utf8");
const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("performance foundation contract", () => {
  it("does not force the public search shell to render dynamically", () => {
    expect(searchPage).not.toContain('dynamic = "force-dynamic"');
  });

  it("uses next/font for the two primary text fonts", () => {
    expect(rootLayout).toContain(
      'import { Manrope, Playfair_Display } from "next/font/google"',
    );
    expect(rootLayout).toContain("const manrope = Manrope({");
    expect(rootLayout).toContain("const playfairDisplay = Playfair_Display({");
    expect(rootLayout).toContain("manrope.variable");
    expect(rootLayout).toContain("playfairDisplay.variable");
  });

  it("does not load Manrope and Playfair through a runtime Google CSS import", () => {
    expect(globals).not.toContain(
      "family=Playfair+Display:wght@600;700&family=Manrope",
    );
  });

  it("keeps Material Symbols available", () => {
    expect(globals).toContain("Material+Symbols+Outlined");
    expect(globals).toContain("display=swap");
  });

  it("maps the existing typography tokens to next/font variables", () => {
    expect(globals).toContain("var(--font-manrope-next)");
    expect(globals).toContain("var(--font-playfair-next)");
  });
});

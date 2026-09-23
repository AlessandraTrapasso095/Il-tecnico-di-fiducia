import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("customer search responsive class integrity", () => {
  it("does not keep known concatenated Tailwind tokens in the search/results area", () => {
    const malformed = [
      "mx-automax-w-[1280px]",
      "gap-2sm:flex-row",
      "min-h-[58px]flex-1",
      "shadow-lgshadow-orange-500/20",
      "bg-surface-container-lowestp-4",
      "text-smtext-on-surface-variant",
      "rounded-fullp-2",
      "border-outline-variant/50bg-surface-container-low",
      "text-buttontext-primary",
      "bg-error-containerpx-4",
      "text-on-error-containershadow-sm",
      "h-10 w-fullrounded-full",
      "border-outline-variant/30bg-surface-container-lowest",
      "min-w-0flex-1",
      "h-11 w-11shrink-0",
      "mt-5 flexflex-wrap",
      "bg-secondary-fixedpx-3",
      "border-tborder-outline-variant/25",
      "flex flex-colgap-3",
      "rounded-fullbg-[#FF8500]",
      "rounded-fullborder-2",
    ];

    for (const token of malformed) {
      expect(source).not.toContain(token);
    }
  });

  it("keeps the active filters accessibility label correctly spaced", () => {
    expect(source).toContain('aria-label="Filtri di ricerca attivi"');
    expect(source).not.toContain('aria-label="Filtri di ricercaattivi"');
  });

  it("keeps the intended responsive result layout", () => {
    expect(source).toContain("data-professional-result-card");
    expect(source).toContain("md:grid-cols-[92px_minmax(0,1fr)_260px]");
    expect(source).toContain("lg:grid-cols-[108px_minmax(0,1fr)_310px]");
    expect(source).toContain("order-1 md:order-3");
    expect(source).toContain("md:hidden");
    expect(source).not.toContain(
      '<div className="grid grid-cols-1 gap-5 lg:grid-cols-2">',
    );
    expect(source).toContain("flex flex-col gap-3 sm:flex-row");
    expect(source).toContain("sm:w-auto");
    expect(source).toContain("sm:grid-cols-2");
  });
});

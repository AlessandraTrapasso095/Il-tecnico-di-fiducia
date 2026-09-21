import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const professionSearch = fs.readFileSync(
  path.join(process.cwd(), "src/components/site/profession-search-flow.tsx"),
  "utf8",
);

describe("profession search suggestion CTA", () => {
  it("shows the technician suggestion CTA below the profession cards", () => {
    expect(professionSearch).toContain("Non trovi quello che stavi cercando?");
    expect(professionSearch).toContain('href="/proponi-un-tecnico"');
    expect(professionSearch).toContain("Proponi un tecnico");
  });

  it("keeps the CTA responsive on mobile and larger screens", () => {
    expect(professionSearch).toContain("w-full");
    expect(professionSearch).toContain("sm:w-auto");
    expect(professionSearch).toContain("sm:flex-row");
  });

  it("places the CTA before the professional search filters", () => {
    const ctaIndex = professionSearch.indexOf('href="/proponi-un-tecnico"');
    const formIndex = professionSearch.indexOf('id="ricerca-professionisti"');

    expect(ctaIndex).toBeGreaterThan(-1);
    expect(formIndex).toBeGreaterThan(ctaIndex);
  });
});

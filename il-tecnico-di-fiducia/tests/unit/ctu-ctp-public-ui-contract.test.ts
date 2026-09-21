import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const publicProfile = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

const publicSearch = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-search/public-professionals-search.tsx",
  ),
  "utf8",
);

describe("CTU / CTP public UI contract", () => {
  it("shows CTU / CTP badges on public professional profile", () => {
    expect(publicProfile).toContain("profile.is_ctu ?");
    expect(publicProfile).toContain("profile.is_ctp ?");
    expect(publicProfile).toContain("CTU");
    expect(publicProfile).toContain("CTP");
  });

  it("supports CTU / CTP fields in public search result type", () => {
    expect(publicSearch).toContain("is_ctu: boolean");
    expect(publicSearch).toContain("is_ctp: boolean");
  });

  it("shows CTU / CTP badges on public search cards", () => {
    expect(publicSearch).toContain(
      "professional.is_ctu || professional.is_ctp",
    );
    expect(publicSearch).toContain("professional.is_ctu ?");
    expect(publicSearch).toContain("professional.is_ctp ?");
  });
});

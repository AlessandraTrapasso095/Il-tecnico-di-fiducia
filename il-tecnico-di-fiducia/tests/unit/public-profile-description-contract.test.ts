import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("public professional profile description", () => {
  it("does not render the short search presentation in the public profile", () => {
    expect(source).not.toContain("{profile.search_summary}");
    expect(source).not.toContain("{professional.search_summary}");
  });

  it("keeps the normal professional bio available", () => {
    expect(source).toContain("bio");
  });

  it("keeps expandable description behavior when present", () => {
    const hasExpandableDescription =
      source.includes("Altro") ||
      source.includes("Chiudi") ||
      source.includes("expanded") ||
      source.includes("line-clamp");

    expect(hasExpandableDescription).toBe(true);
  });
});

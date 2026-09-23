import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const component = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("public professional profile persistent sidebar contract", () => {
  it("uses one shared two-column layout for every tab", () => {
    expect(component).toContain(
      "md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]",
    );
  });

  it("keeps the sidebar outside individual tab conditions", () => {
    const gridStart = component.indexOf(
      "md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]",
    );

    const profileTab = component.indexOf('tab === "profile"', gridStart);

    const worksTab = component.indexOf('tab === "works"', gridStart);

    const reviewsTab = component.indexOf('tab === "reviews"', gridStart);

    const aside = component.indexOf('<aside className="space-y-9', gridStart);

    expect(profileTab).toBeGreaterThan(gridStart);
    expect(worksTab).toBeGreaterThan(profileTab);
    expect(reviewsTab).toBeGreaterThan(worksTab);
    expect(aside).toBeGreaterThan(reviewsTab);
  });

  it("keeps reviews, specializations and services in the shared sidebar", () => {
    expect(component).toContain("Specializzazioni");
    expect(component).toContain("Servizi offerti");
    expect(component).toContain('onClick={() => selectProfileTab("reviews")}');
  });

  it("keeps the divider on tablet and desktop", () => {
    expect(component).toContain(
      "md:border-l md:border-outline-variant/30 md:pl-8 lg:pl-10",
    );
  });

  it("stacks naturally on phone and becomes two columns from tablet", () => {
    expect(component).toContain(
      'className="grid gap-10 py-8 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]',
    );
    expect(component).not.toContain(
      'className="grid grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]',
    );
  });
});

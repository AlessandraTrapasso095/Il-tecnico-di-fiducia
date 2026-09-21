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

describe("public profile continuous carousel runtime contract", () => {
  it("keeps a floating-point scroll accumulator", () => {
    expect(component).toContain(
      "let scrollPosition = activeCarousel.scrollLeft",
    );

    expect(component).toContain("scrollPosition +=");

    expect(component).toContain("activeCarousel.scrollLeft =");
  });

  it("uses requestAnimationFrame for genuinely continuous motion", () => {
    expect(component).toContain("window.requestAnimationFrame(animate)");

    expect(component).toContain("window.cancelAnimationFrame(");

    expect(component).not.toContain("window.setInterval");
  });

  it("keeps the intended slow speed", () => {
    expect(component).toContain("pixelsPerSecond = 26");
  });

  it("pauses on hover and resumes when hover leaves", () => {
    expect(component).toContain("onMouseEnter={() => setCarouselPaused(true)}");

    expect(component).toContain(
      "onMouseLeave={() => setCarouselPaused(false)}",
    );
  });

  it("uses prominent desktop hover arrows", () => {
    expect(component).toContain("z-30 hidden size-12");

    expect(component).toContain("bg-primary text-white");

    expect(component).toContain("md:group-hover:opacity-100");
  });
});

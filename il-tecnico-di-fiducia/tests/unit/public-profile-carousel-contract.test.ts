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

describe("public professional profile work carousel contract", () => {
  it("continuously autoplays the work preview", () => {
    expect(component).toContain("window.requestAnimationFrame");
    expect(component).toContain("window.cancelAnimationFrame");
    expect(component).toContain("pixelsPerSecond = 26");
    expect(component).toContain("profile.work_media.map");
    expect(component).not.toContain(
      "[...profile.work_media, ...profile.work_media]",
    );
    expect(component).toContain("worksCarouselRef");
  });

  it("pauses while the desktop pointer interacts with the carousel", () => {
    expect(component).toContain("onMouseEnter={() => setCarouselPaused(true)}");
    expect(component).toContain(
      "onMouseLeave={() => setCarouselPaused(false)}",
    );
  });

  it("provides hover arrows on desktop", () => {
    expect(component).toContain("scrollWorksCarousel(-1)");
    expect(component).toContain("scrollWorksCarousel(1)");
    expect(component).toContain("md:group-hover:opacity-100");
  });

  it("remains horizontally scrollable on phone and tablet", () => {
    expect(component).toContain("overflow-x-auto");
    expect(component).toContain('WebkitOverflowScrolling: "touch"');
    expect(component).not.toContain("touch-pan-x");
  });

  it("opens the Works tab at the post connected to a clicked photo", () => {
    expect(component).toContain("openWorkPost(media.post_id)");
    expect(component).toContain("public-work-post-${post.id}");
    expect(component).toContain("scrollIntoView");
  });

  it("shows a clickable review summary above sidebar profile details", () => {
    expect(component).toContain('onClick={() => selectProfileTab("reviews")}');
    expect(component).toContain("profile.rating_average");
    expect(component).toContain("profile.reviews_count");
  });
});

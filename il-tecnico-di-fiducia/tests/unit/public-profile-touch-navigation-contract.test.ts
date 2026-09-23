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

describe("public profile mobile carousel and tab navigation", () => {
  it("uses native horizontal scrolling on iOS", () => {
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain('WebkitOverflowScrolling: "touch"');
    expect(source).not.toContain("touch-pan-x");
  });

  it("keeps continuous autoplay available on touch devices", () => {
    expect(source).not.toContain("isTouchCarousel");
    expect(source).not.toContain('window.matchMedia("(pointer: coarse)")');
    expect(source).toContain("[carouselPaused, profile.work_media.length]");
  });

  it("keeps safe touch handlers", () => {
    expect(source).toContain("onTouchStart={pauseCarouselForTouch}");
    expect(source).toContain("onTouchEnd={resumeCarouselAfterTouch}");
    expect(source).toContain("onTouchCancel={resumeCarouselAfterTouch}");
  });

  it("scrolls to the rendered panel rather than the whole grid", () => {
    expect(source).toContain(
      "document.getElementById(`profile-tab-${nextTab}`)?.scrollIntoView({",
    );

    expect(source).not.toContain("profileContentRef");
  });

  it("provides individual anchors for all three profile tabs", () => {
    expect(source).toContain('id="profile-tab-profile"');
    expect(source).toContain('id="profile-tab-works"');
    expect(source).toContain('id="profile-tab-reviews"');
  });

  it("uses visual navigation for the tab bar and review card", () => {
    expect(source).toContain(
      "onClick={() => selectProfileTab(value as TabId)}",
    );

    expect(source).toContain('onClick={() => selectProfileTab("reviews")}');
  });
});

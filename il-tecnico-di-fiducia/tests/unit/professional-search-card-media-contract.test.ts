import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const api = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/professionals/route.ts"),
  "utf8",
);

const customer = fs.readFileSync(
  path.join(process.cwd(), "src/app/customer/customer-dashboard-client.tsx"),
  "utf8",
);

describe("professional search card media", () => {
  it("exposes search_summary from the professional directory", () => {
    expect(api).toContain("search_summary: string | null");
    expect(api).toContain("headline, search_summary, bio, specializations");
  });

  it("loads portfolio media only for returned professionals", () => {
    expect(api).toContain("async function attachProfessionalCardMedia");
    expect(api).toContain('.from("post_attachments")');
    expect(api).toContain('.in("user_id", professionalIds)');
    expect(api).toContain('.in("file_type", ["image", "video"])');
  });

  it("keeps card portfolio previews limited", () => {
    expect(api).toContain("if (existing.length >= 5)");
    expect(api).toContain("work_media:");
  });

  it("keeps media failures non-blocking", () => {
    expect(api).toContain(
      'query: "post_attachments card media by professional ids"',
    );
    expect(api).toContain("work_media: []");
  });

  it("enriches all professional result paths", () => {
    expect(api).toContain("professionalsWithMedia");
    expect(api).toContain("recommendedProfessionalsWithMedia");
    expect(api).toContain("paginatedProfessionalsWithMedia");
  });

  it("auto-advances one media item at a time", () => {
    expect(customer).toContain("window.setInterval");
    expect(customer).toContain("}, 2500);");
    expect(customer).toContain("current >= media.length - 1 ? 0 : current + 1");
  });

  it("pauses autoplay on desktop interaction", () => {
    expect(customer).toContain("onMouseEnter={() => setIsPaused(true)}");
    expect(customer).toContain("onMouseLeave={() => setIsPaused(false)}");
    expect(customer).toContain("md:group-hover/media:opacity-100");
  });

  it("supports touch swipe and manual navigation", () => {
    expect(customer).toContain("handleTouchStart");
    expect(customer).toContain("handleTouchEnd");
    expect(customer).toContain("Math.abs(delta) < 40");
    expect(customer).toContain('aria-label="Lavoro precedente"');
    expect(customer).toContain('aria-label="Lavoro successivo"');
  });

  it("uses a delicate transition when the active media changes", () => {
    expect(customer).toContain("media-swap-fade");
  });

  it("does not autoplay or render navigation needlessly for one item", () => {
    expect(customer).toContain("if (media.length <= 1)");
    expect(customer).toContain("media.length > 1 ? (");
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const loader = fs.readFileSync(
  path.join(root, "src/lib/server/professional-profile.ts"),
  "utf8",
);

const component = fs.readFileSync(
  path.join(
    root,
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("public professional work gallery contract", () => {
  it("loads work media server-side from the professional attachments", () => {
    expect(loader).toContain("work_media: {");
    expect(loader).toContain('.from("post_attachments")');
    expect(loader).toContain('.eq("user_id", professionalId)');
    expect(loader).toContain("work_media: (workMedia ?? [])");
  });

  it("exposes only public gallery media fields", () => {
    expect(loader).toContain("public_url: media.file_url");
    expect(loader).toContain("media_type:");
    expect(loader).not.toContain("file_path: media.file_path");
  });

  it("renders the gallery only when real media exists without duplicating it", () => {
    expect(component).toContain("profile.work_media.length > 0 ?");
    expect(component).toContain("profile.work_media.map(");
    expect(component).not.toContain(
      "[...profile.work_media, ...profile.work_media]",
    );
  });

  it("supports both image and video work media", () => {
    expect(component).toContain('media.media_type === "image"');
    expect(component).toContain("<video");
  });

  it("uses phone, tablet and desktop carousel widths", () => {
    expect(component).toContain("w-[82%]");
    expect(component).toContain("sm:w-[48%]");
    expect(component).toContain("md:w-[32%]");
    expect(component).toContain("lg:w-[24%]");
  });

  it("does not render an empty placeholder in the work preview", () => {
    const previewStart = component.indexOf("profile.work_media.length > 0 ?");

    const tabsStart = component.indexOf('aria-label="Sezioni profilo"');

    expect(previewStart).toBeGreaterThanOrEqual(0);
    expect(tabsStart).toBeGreaterThan(previewStart);

    const previewSection = component.slice(previewStart, tabsStart);

    expect(previewSection).not.toContain("Nessun lavoro pubblicato");
  });
});

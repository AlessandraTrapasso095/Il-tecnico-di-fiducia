import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const profileSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

const controlsSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/owner-work-controls.tsx",
  ),
  "utf8",
);

const postsApi = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/posts/route.ts"),
  "utf8",
);

const postApi = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/posts/[id]/route.ts"),
  "utf8",
);

const attachmentsApi = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/posts/[id]/attachments/route.ts"),
  "utf8",
);

describe("unified owner works management", () => {
  it("shows work controls only through owner context", () => {
    expect(profileSource).toContain("<OwnerNewWorkButton");

    expect(profileSource).toContain("<OwnerPostActions");

    expect(profileSource).toContain("viewerContext?.isOwner");
  });

  it("reuses existing create API", () => {
    expect(controlsSource).toContain('"/api/posts"');

    expect(controlsSource).toContain('method: "POST"');

    expect(postsApi).toContain("export async function POST");
  });

  it("reuses existing update and delete API", () => {
    expect(controlsSource).toContain("`/api/posts/${post.id}`");

    expect(controlsSource).toContain('method: "PATCH"');

    expect(controlsSource).toContain('method: "DELETE"');

    expect(postApi).toContain("export async function PATCH");

    expect(postApi).toContain("export async function DELETE");
  });

  it("supports post media with current server limits", () => {
    expect(controlsSource).toContain("const MAX_FILES = 6");

    expect(controlsSource).toContain("4.7 * 1024 * 1024");

    expect(attachmentsApi).toContain("const MAX_FILES = 6");

    expect(attachmentsApi).toContain("4.7 * 1024 * 1024");
  });

  it("supports current image and video types", () => {
    for (const mime of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ]) {
      expect(controlsSource).toContain(mime);

      expect(attachmentsApi).toContain(mime);
    }
  });

  it("supports removal of individual existing attachments", () => {
    expect(controlsSource).toContain("/attachments/${attachmentId}");

    expect(controlsSource).toContain("removedIds");
  });

  it("refreshes server-derived works and carousel after mutation", () => {
    expect(controlsSource).toContain("window.location.reload()");
  });

  it("cleans up a newly created post if media upload fails", () => {
    expect(controlsSource).toContain("await uploadFiles(");

    expect(controlsSource).toContain("`/api/posts/${payload.post.id}`");

    expect(controlsSource).toContain('method: "DELETE"');
  });
});

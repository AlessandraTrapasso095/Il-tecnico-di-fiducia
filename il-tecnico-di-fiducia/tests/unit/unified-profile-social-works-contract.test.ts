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

const likeRoute = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/posts/[id]/likes/route.ts"),
  "utf8",
);

const commentRoute = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/posts/[id]/comments/route.ts"),
  "utf8",
);

describe("unified profile social works", () => {
  it("reuses the shared comments component", () => {
    expect(component).toContain("@/components/posts/post-comments");

    expect(component).toContain("<PostComments");

    expect(component).toContain("onCountChange");
  });

  it("restricts social interactions to professional viewers", () => {
    expect(component).toContain('viewerContext?.role === "professional"');

    expect(component).toContain('viewerContext?.role !== "professional"');

    expect(component).toContain("Mi piace ·");

    expect(component).toContain("Commenti ·");
  });

  it("loads social metadata from the authenticated posts API", () => {
    expect(component).toContain("/api/posts?author_id=");

    expect(component).toContain("likes_count");

    expect(component).toContain("comments_count");

    expect(component).toContain("liked_by_me");
  });

  it("supports both like and unlike", () => {
    expect(component).toContain("/likes");

    expect(component).toContain('"DELETE"');

    expect(component).toContain('"POST"');

    expect(component).toContain("current.liked_by_me");
  });

  it("updates the comment counter through PostComments", () => {
    expect(component).toContain("comments_count:");

    expect(component).toContain("current.comments_count +");

    expect(component).toContain("viewerId={viewerContext.id}");
  });

  it("preserves post like notifications", () => {
    expect(likeRoute).toContain("ensureSocialNotification");

    expect(likeRoute).toContain('type: "post_liked"');
  });

  it("preserves post comment notifications", () => {
    expect(commentRoute).toContain("ensureSocialNotification");

    expect(commentRoute).toContain('type: "post_commented"');
  });
});

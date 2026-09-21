import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const postsRoute = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/posts/route.ts"),
  "utf8",
);

describe("professional profile post access", () => {
  it("keeps following logic for the following feed", () => {
    expect(postsRoute).toContain('feed === "following"');

    expect(postsRoute).toContain('.from("professional_follows")');

    expect(postsRoute).toContain("followed_id");
  });

  it("does not require follow to view another professional profile posts", () => {
    const authorBranchStart = postsRoute.indexOf("} else if (authorId) {");

    const postsBuilderStart = postsRoute.indexOf(
      '.from("posts")',
      authorBranchStart,
    );

    expect(authorBranchStart).toBeGreaterThanOrEqual(0);
    expect(postsBuilderStart).toBeGreaterThan(authorBranchStart);

    const authorBranch = postsRoute.slice(authorBranchStart, postsBuilderStart);

    expect(authorBranch).not.toContain('.from("professional_follows")');

    expect(authorBranch).not.toContain("followed_id");
  });

  it("checks professional directory visibility for non-owner profile access", () => {
    expect(postsRoute).toContain('.from("professional_directory")');

    expect(postsRoute).toContain(
      'if (authorId !== user.id && viewer.role !== "admin")',
    );

    expect(postsRoute).toContain("visibleProfessional");
  });

  it("still filters the post query by requested author", () => {
    expect(postsRoute).toContain("authorIds = [authorId]");

    expect(postsRoute).toContain(
      'builder = builder.in("author_id", authorIds)',
    );
  });
});

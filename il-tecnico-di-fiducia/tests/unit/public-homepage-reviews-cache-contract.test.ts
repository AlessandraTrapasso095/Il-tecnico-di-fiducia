import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/server/public-reviews.ts", "utf8");

describe("public homepage reviews cache contract", () => {
  it("keeps the review loader server only", () => {
    expect(source).toContain('import "server-only"');
  });

  it("uses a server-side Next cache wrapper", () => {
    expect(source).toContain('import { unstable_cache } from "next/cache"');

    expect(source).toContain(
      "export const getPublicHomepageReviews = unstable_cache(",
    );
  });

  it("uses a bounded five minute cache", () => {
    expect(source).toContain("revalidate: 300");
  });

  it("defines a dedicated cache tag", () => {
    expect(source).toContain('tags: ["public-homepage-reviews"]');
  });

  it("keeps the underlying loader private", () => {
    expect(source).toContain("async function loadPublicHomepageReviews()");

    expect(source).not.toContain(
      "export async function getPublicHomepageReviews()",
    );
  });
});

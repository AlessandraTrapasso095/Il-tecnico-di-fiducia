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

describe("public professional post visual contract", () => {
  it("uses the real post title instead of deriving it from body", () => {
    expect(component).not.toContain("function splitPostBody(");
    expect(component).not.toContain("splitPostBody(post.body)");
    expect(component).toContain("post.title ? (");
    expect(component).toContain("{post.title}");
  });

  it("renders the real post title in bold", () => {
    expect(component).toContain("text-lg font-bold leading-6 text-primary");
  });

  it("keeps legacy posts without title renderable", () => {
    expect(component).toContain("post.title ? (");
    expect(component).toContain("{post.body}");
  });

  it("renders the post date in bold", () => {
    expect(component).toContain("text-sm font-bold text-on-surface-variant");
  });

  it("keeps the post body normal weight", () => {
    expect(component).toContain("font-normal leading-7");
  });

  it("keeps post images visually smaller", () => {
    expect(component).toContain("max-w-[720px] grid-cols-1");
  });

  it("uses less rounded work images", () => {
    expect(component).toContain("rounded-xl");
    expect(component).toContain("rounded-lg");
  });
});

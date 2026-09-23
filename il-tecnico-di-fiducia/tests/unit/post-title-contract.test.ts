import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const migration = read("supabase/migrations/20260923100000_posts_title.sql");
const postsRoute = read("src/app/api/posts/route.ts");
const postRoute = read("src/app/api/posts/[id]/route.ts");
const serverProfile = read("src/lib/server/professional-profile.ts");
const dashboard = read(
  "src/app/professionista/professional-dashboard-client.tsx",
);
const legacyProfile = read(
  "src/components/professionals/professional-profile-client.tsx",
);
const mediaUi = read("src/components/posts/post-media-ui.tsx");
const ownerWorks = read(
  "src/components/public-profile/owner-work-controls.tsx",
);

describe("professional post title contract", () => {
  it("adds a nullable database title for legacy compatibility", () => {
    expect(migration).toContain("add column if not exists title text");
    expect(migration).toContain("posts_title_length_check");
    expect(migration).toContain("char_length(title) <= 120");
    expect(migration).not.toContain("title text not null");
    expect(migration).not.toContain("update public.posts");
  });

  it("returns title from the posts API", () => {
    expect(postsRoute).toContain(
      '"id, author_id, title, body, created_at, updated_at"',
    );
  });

  it("requires title when a new post is created", () => {
    expect(postsRoute).toContain("title: string;");
    expect(postsRoute).toContain('error: "title is required"');
    expect(postsRoute).toContain("MAX_POST_TITLE_LENGTH = 120");
  });

  it("requires title when a post is edited", () => {
    expect(postRoute).toContain("title: string;");
    expect(postRoute).toContain('error: "title is required"');
    expect(postRoute).toContain("title,");
    expect(postRoute).toContain(
      '"id, author_id, title, body, created_at, updated_at"',
    );
  });

  it("loads the real title for the public professional profile", () => {
    expect(serverProfile).toContain('.select("id, title, body, created_at")');
    expect(serverProfile).toContain("title: post.title ?? null");
    expect(serverProfile).toContain("title: string | null;");
  });

  it("propagates title through client post types", () => {
    expect(dashboard).toContain("title: string | null;");
    expect(legacyProfile).toContain("title: string | null;");
    expect(mediaUi).toContain("title?: string | null;");
    expect(ownerWorks).toContain("title?: string | null;");
  });
});

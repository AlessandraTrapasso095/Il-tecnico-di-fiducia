import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const ownerWorks = read(
  "src/components/public-profile/owner-work-controls.tsx",
);
const editModal = read("src/components/posts/post-media-ui.tsx");
const publicProfile = read(
  "src/components/public-profile/public-professional-profile.tsx",
);
const postsApi = read("src/app/api/posts/route.ts");
const postApi = read("src/app/api/posts/[id]/route.ts");

describe("post title + body UI contract", () => {
  it("provides separate title and body fields in owner work editor", () => {
    expect(ownerWorks).toContain("postTitle");
    expect(ownerWorks).toContain("Titolo");
    expect(ownerWorks).toContain("Corpo");
    expect(ownerWorks).toContain("maxLength={120}");
    expect(ownerWorks).toContain("maxLength={1200}");
  });

  it("requires both title and body before owner save", () => {
    expect(ownerWorks).toContain("!cleanTitle(postTitle)");
    expect(ownerWorks).toContain("!cleanBody(body)");
  });

  it("sends title and body from owner create and update", () => {
    expect(ownerWorks).toContain(
      "const cleanPostTitle = cleanTitle(postTitle)",
    );
    expect(ownerWorks).toContain("title: cleanPostTitle");
    expect(ownerWorks).toContain("body: clean");
  });

  it("provides title and body in the shared post editor", () => {
    expect(editModal).toContain(
      'const [title, setTitle] = useState(post.title ?? "")',
    );
    expect(editModal).toContain("Titolo");
    expect(editModal).toContain("Corpo");
    expect(editModal).toContain(
      "await onSave(cleanTitle, cleanBody, removedAttachmentIds, newFiles)",
    );
    expect(editModal).toContain(
      "disabled={busy || !title.trim() || !body.trim()}",
    );
  });

  it("renders real titles and normal bodies publicly", () => {
    expect(publicProfile).toContain("{post.title}");
    expect(publicProfile).toContain("{post.body}");
    expect(publicProfile).not.toContain("splitPostBody(post.body)");
  });

  it("requires title in create and update APIs", () => {
    expect(postsApi).toContain("title: string;");
    expect(postsApi).toContain('error: "title is required"');

    expect(postApi).toContain("title: string;");
    expect(postApi).toContain('error: "title is required"');
  });
});

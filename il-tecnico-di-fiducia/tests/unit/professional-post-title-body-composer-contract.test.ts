import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const dashboard = read(
  "src/app/professionista/professional-dashboard-client.tsx",
);

const legacy = read(
  "src/components/professionals/professional-profile-client.tsx",
);

describe("professional post title + body composer contract", () => {
  it("uses separate title and body state in dashboard", () => {
    expect(dashboard).toContain(
      'const [postTitle, setPostTitle] = useState("")',
    );
    expect(dashboard).toContain("value={postTitle}");
    expect(dashboard).toContain("value={postBody}");
  });

  it("creates dashboard posts with title and body", () => {
    expect(dashboard).toContain(
      'const title = postTitle.replace(/\\s+/g, " ").trim()',
    );
    expect(dashboard).toContain("title,");
    expect(dashboard).toContain("body,");
    expect(dashboard).toContain('setPostTitle("")');
  });

  it("renders dashboard post title bold and body normally", () => {
    expect(dashboard).toContain("{post.title}");
    expect(dashboard).toContain("{post.body}");
    expect(dashboard).toContain("font-bold");
    expect(dashboard).toContain("font-normal");
  });

  it("uses separate title and body state in legacy composer", () => {
    expect(legacy).toContain('const [postTitle, setPostTitle] = useState("")');
    expect(legacy).toContain("postTitle={postTitle}");
    expect(legacy).toContain("setPostTitle={setPostTitle}");
    expect(legacy).toContain("value={postTitle}");
    expect(legacy).toContain("value={postBody}");
  });

  it("creates legacy posts with title and body", () => {
    expect(legacy).toContain(
      'const title = postTitle.replace(/\\s+/g, " ").trim()',
    );
    expect(legacy).toContain("title,");
    expect(legacy).toContain("body,");
    expect(legacy).toContain('setPostTitle("")');
  });

  it("renders legacy title bold and body normally", () => {
    expect(legacy).toContain("{post.title}");
    expect(legacy).toContain("{post.body}");
    expect(legacy).toContain("font-bold");
    expect(legacy).toContain("font-normal");
  });

  it("keeps asynchronous publish loading copy", () => {
    expect(dashboard).toContain("Caricamento…");
    expect(legacy).toContain("Caricamento…");
    expect(dashboard).toContain("progress_activity");
    expect(legacy).toContain("progress_activity");
  });
});

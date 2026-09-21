import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const component = fs.readFileSync(
  path.join(
    root,
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

const loader = fs.readFileSync(
  path.join(root, "src/lib/server/professional-profile.ts"),
  "utf8",
);

describe("public professional profile tabs contract", () => {
  it("provides Profile, Works and Reviews tabs", () => {
    expect(component).toContain('"profile", "Profilo"');
    expect(component).toContain('"works", "Lavori"');
    expect(component).toContain('"reviews", "Recensioni"');
  });

  it("uses horizontally scrollable tabs on small screens", () => {
    expect(component).toContain("overflow-x-auto");
    expect(component).toContain("min-w-max");
  });

  it("gives the profile content more space than the sidebar", () => {
    expect(component).toContain(
      "md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]",
    );
  });

  it("loads public CV-like structured profile information", () => {
    expect(loader).toContain("education: string[]");
    expect(loader).toContain("work_experiences: string[]");
    expect(loader).toContain("certifications: string[]");
    expect(loader).toContain("education: toTextList(professional.education)");
  });

  it("loads complete public work posts", () => {
    expect(loader).toContain("work_posts:");
    expect(loader).toContain('.from("posts")');
    expect(loader).toContain('.eq("author_id", professionalId)');
  });

  it("loads full public review content and professional replies", () => {
    expect(loader).toContain("reviews:");
    expect(loader).toContain("professional_reply");
    expect(loader).toContain("professional_replied_at");
  });
});

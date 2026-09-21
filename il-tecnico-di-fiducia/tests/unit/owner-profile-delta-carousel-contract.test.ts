import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const publicProfile = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

const editModal = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/owner-profile-edit-modal.tsx",
  ),
  "utf8",
);

describe("owner profile delta save and carousel", () => {
  it("renders the real work media collection without duplicating it", () => {
    expect(publicProfile).toContain(
      "profile.work_media.map((media, index) =>",
    );

    expect(publicProfile).not.toContain(
      "[...profile.work_media, ...profile.work_media]",
    );
  });

  it("autoplays using the real scrollable width", () => {
    expect(publicProfile).toContain(
      "activeCarousel.scrollWidth - activeCarousel.clientWidth",
    );

    expect(publicProfile).not.toContain(
      "activeCarousel.scrollWidth / 2",
    );
  });

  it("sends only owner profile fields that actually changed", () => {
    expect(editModal).toContain(
      "const payload: Record<string, unknown> = {}",
    );

    expect(editModal).toContain(
      "if (draft.bio !== initialDraft.bio)",
    );

    expect(editModal).toContain(
      "if (draft.website_url !== initialDraft.website_url)",
    );

    expect(editModal).toContain(
      "draft.operational_provinces !==",
    );

    expect(editModal).toContain(
      "if (Object.keys(payload).length === 0)",
    );

    expect(editModal).toContain(
      "body: JSON.stringify(payload)",
    );
  });

  it("keeps structured curriculum serialization", () => {
    expect(editModal).toContain(
      "payload.education = jsonFromLines(draft.education)",
    );

    expect(editModal).toContain(
      "payload.work_experiences = jsonFromLines(",
    );

    expect(editModal).toContain(
      "payload.certifications = jsonFromLines(",
    );
  });
});

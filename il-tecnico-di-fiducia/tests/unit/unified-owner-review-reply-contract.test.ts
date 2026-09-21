import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const unifiedProfile = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("unified owner review reply", () => {
  it("keeps reviews in local state so the saved reply appears immediately", () => {
    expect(unifiedProfile).toContain("const [reviews, setReviews]");
    expect(unifiedProfile).toContain("setReviews((current)");
    expect(unifiedProfile).toContain("reviews.map((review)");
  });

  it("uses the existing one-time review reply endpoint", () => {
    expect(unifiedProfile).toContain("async function replyToReview");
    expect(unifiedProfile).toContain("/api/reviews/");
    expect(unifiedProfile).toContain("/reply");
    expect(unifiedProfile).toContain('method: "POST"');
  });

  it("shows reply controls only to the profile owner when no reply exists", () => {
    expect(unifiedProfile).toContain("viewerContext?.isOwner");
    expect(unifiedProfile).toContain(
      'placeholder="Rispondi a questa recensione..."',
    );
    expect(unifiedProfile).toContain("review.professional_replied_at");
  });

  it("provides visible loading and error feedback", () => {
    expect(unifiedProfile).toContain("Invio in corso…");
    expect(unifiedProfile).toContain("replySubmitting[review.id]");
    expect(unifiedProfile).toContain("replyErrors[review.id]");
    expect(unifiedProfile).toContain('role="alert"');
  });

  it("keeps the reply action responsive", () => {
    expect(unifiedProfile).toContain("w-full");
    expect(unifiedProfile).toContain("sm:w-auto");
  });
});

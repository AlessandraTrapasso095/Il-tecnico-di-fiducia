import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/professionals/route.ts"),
  "utf8",
);

describe("professional search no hard cap contract", () => {
  it("does not keep the old 1000-candidate hard cap", () => {
    expect(source).not.toContain("MAX_LOCAL_SEARCH_CANDIDATES");
    expect(source).not.toContain(".limit(1_000)");
    expect(source).not.toContain(".limit(1000)");
  });

  it("does not truncate recommended professionals at 200", () => {
    expect(source).not.toContain(".limit(200)");
  });

  it("fetches directory candidates in batches until exhausted", () => {
    expect(source).toContain("const DIRECTORY_FETCH_BATCH_SIZE = 500;");
    expect(source).toContain(
      "candidateOffset + DIRECTORY_FETCH_BATCH_SIZE - 1",
    );
    expect(source).toContain(
      "recommendedOffset + DIRECTORY_FETCH_BATCH_SIZE - 1",
    );
    expect(source).toContain("if (batch.length < DIRECTORY_FETCH_BATCH_SIZE)");
  });

  it("keeps page size as pagination rather than total-result cap", () => {
    expect(source).toContain(
      'const pageSize = clampInt(searchParams.get("page_size"), 12, 1, 50);',
    );
    expect(source).toContain(
      "const pagedProfessionals = sorted.slice(rangeFrom, rangeTo + 1)",
    );
    expect(source).toContain(
      "const pagedRecommendedProfessionals = sorted.slice(",
    );
    expect(source).toContain("professionals: professionalsWithMedia");
    expect(source).toContain(
      "professionals: recommendedProfessionalsWithMedia",
    );
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260922120000_professional_search_summary.sql",
  ),
  "utf8",
);

const profileLoader = fs.readFileSync(
  path.join(process.cwd(), "src/lib/server/professional-profile.ts"),
  "utf8",
);

const editModal = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/owner-profile-edit-modal.tsx",
  ),
  "utf8",
);

const professionalApi = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/professionals/[id]/route.ts"),
  "utf8",
);

describe("professional search summary", () => {
  it("adds search_summary to profile and public directory with a 180 char DB limit", () => {
    expect(migration).toContain("alter table public.professional_profiles");
    expect(migration).toContain("alter table public.professional_directory");
    expect(migration).toContain("add column if not exists search_summary text");
    expect(migration).toContain("char_length(search_summary) <= 180");
  });

  it("keeps directory sync complete, including taxonomy and CTU/CTP", () => {
    expect(migration).toContain("search_summary");
    expect(migration).toContain("subcategory_id");
    expect(migration).toContain("available_remote");
    expect(migration).toContain("available_travel");
    expect(migration).toContain("is_ctu");
    expect(migration).toContain("is_ctp");
    expect(migration).toContain("new.search_summary");
  });

  it("exposes search_summary on the public professional profile", () => {
    expect(profileLoader).toContain("search_summary: string | null");
    expect(profileLoader).toContain(
      "professional.search_summary ?? directory.search_summary ?? null",
    );
  });

  it("lets the owner edit the short presentation with a visible counter", () => {
    expect(editModal).toContain('label="Presentazione breve"');
    expect(editModal).toContain("search_summary");
    expect(editModal).toContain("maxLength={180}");
    expect(editModal).toContain("showCount");
    expect(editModal).toContain("{value.length}/{maxLength}");
    expect(editModal).toContain("required");
    expect(editModal).toContain(
      "La presentazione breve è obbligatoria.",
    );
  });

  it("sends only changed search_summary data", () => {
    expect(editModal).toContain(
      "draft.search_summary !== initialDraft.search_summary",
    );
    expect(editModal).toContain(
      "payload.search_summary = draft.search_summary.trim();",
    );
  });

  it("accepts search_summary through the professional PATCH API with max 180 chars", () => {
    expect(professionalApi).toContain("search_summary?: string | null");
    expect(professionalApi).toContain(
      "optionalText(payload.search_summary, 180)",
    );
    expect(professionalApi).toContain("professionalUpdates.search_summary");
    expect(professionalApi).toContain(
      'error: "La presentazione breve è obbligatoria."',
    );
  });
});

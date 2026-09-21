import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260917111500_professional_posts_no_follow_gate.sql",
  ),
  "utf8",
);

const contentHardening = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260512141000_rls_hardening_content.sql",
  ),
  "utf8",
);

describe("professional post RLS without follow gate", () => {
  it("redefines professional post visibility", () => {
    expect(migration).toContain(
      "create or replace function public.can_view_professional_posts",
    );
  });

  it("keeps customer visibility delegated to the existing helper", () => {
    expect(migration).toContain(
      "public.customer_can_view_professional(pro_id)",
    );
  });

  it("allows professional viewers without consulting follows", () => {
    expect(migration).toContain("public.is_professional()");

    expect(migration).not.toContain("professional_follows");
  });

  it("does not redefine post write policies", () => {
    expect(migration).not.toContain("professional insert own");

    expect(migration).not.toContain("professional update own");

    expect(migration).not.toContain("professional delete own");
  });

  it("keeps likes and comments delegated through can_view_post", () => {
    expect(contentHardening).toContain(
      "using ((select public.can_view_post(post_id)))",
    );

    expect(contentHardening).toContain(
      "and (select public.can_view_post(post_id))",
    );
  });
});

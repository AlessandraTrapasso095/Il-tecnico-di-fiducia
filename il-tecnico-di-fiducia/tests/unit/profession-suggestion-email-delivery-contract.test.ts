import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/server/profession-suggestions.ts", "utf8");

const migration = readFileSync(
  "supabase/migrations/20260924131000_profession_suggestion_email_delivery.sql",
  "utf8",
);

describe("profession suggestion email delivery contract", () => {
  it("stores independent delivery state for admin and user emails", () => {
    expect(migration).toContain("admin_email_sent_at");
    expect(migration).toContain("user_email_sent_at");
    expect(migration).toContain("admin_email_claim_token");
    expect(migration).toContain("user_email_claim_token");
  });

  it("uses atomic claim and completion RPCs", () => {
    expect(migration).toContain(
      "create or replace function public.claim_profession_suggestion_email",
    );

    expect(migration).toContain(
      "create or replace function public.complete_profession_suggestion_email",
    );

    expect(source).toContain('"claim_profession_suggestion_email"');
    expect(source).toContain('"complete_profession_suggestion_email"');
  });

  it("does not resend email already marked as delivered", () => {
    expect(source).toContain("if (alreadySentAt)");
    expect(source).toContain("Email already delivered");
  });

  it("treats an SMTP non-delivery result as failure", () => {
    expect(source).toContain("if (!result.sent)");
    expect(source).toContain("email was not delivered");
  });

  it("releases the claim after a failed delivery", () => {
    expect(source).toContain("delivered: false");
    expect(source).toContain("PROFESSION_SUGGESTION EMAIL CLAIM RELEASE ERROR");
  });

  it("does not swallow delivery failures with Promise.allSettled", () => {
    expect(source).not.toContain("Promise.allSettled");
  });

  it("allows stale claims to be reclaimed", () => {
    expect(migration).toContain("claimed_at < now() - interval '10 minutes'");
  });

  it("limits delivery RPCs to the service role", () => {
    expect(migration).toContain(
      "grant execute on function public.claim_profession_suggestion_email",
    );

    expect(migration).toContain(
      "grant execute on function public.complete_profession_suggestion_email",
    );

    expect(migration).toContain("to service_role");
  });
});

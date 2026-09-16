import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("rate limit security boundary", () => {
  it("keeps the rate-limit helper server-only and service-role backed", () => {
    const source = fs.readFileSync(
      path.join(root, "src/lib/api/rate-limit.ts"),
      "utf8",
    );

    expect(source).toContain('import "server-only"');
    expect(source).toContain("createServiceClient");
    expect(source).toContain('service.rpc("rate_limit_check"');
    expect(source).not.toContain("supabase: SupabaseClient");
  });

  it("revokes direct client execution of rate_limit_check", () => {
    const migration = fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20260916100000_rate_limit_rpc_server_only.sql",
      ),
      "utf8",
    );

    expect(migration).toMatch(
      /revoke execute[\s\S]*rate_limit_check\(text,\s*int,\s*int\)[\s\S]*from public,\s*anon,\s*authenticated/i,
    );

    expect(migration).toMatch(
      /grant execute[\s\S]*rate_limit_check\(text,\s*int,\s*int\)[\s\S]*to service_role/i,
    );
  });
});

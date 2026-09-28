import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const validatorPath = path.join(
  process.cwd(),
  "scripts/check-production-env.mjs",
);

const validRequiredEnv = {
  NEXT_PUBLIC_SITE_URL: "https://iltecnicodifiducia.it",

  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",

  RATE_LIMIT_SALT: "test-rate-limit-salt",

  STRIPE_SECRET_KEY: "stripe-secret-test-value",
  STRIPE_WEBHOOK_SECRET: "stripe-webhook-test-value",
  STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly_test",
  STRIPE_PRO_ANNUAL_PRICE_ID: "price_annual_test",
  STRIPE_PROFESSION_SUGGESTION_PRICE_ID: "price_suggestion_test",

  SMTP_HOST: "mail.example.test",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "mailer@example.test",
  SMTP_PASS: "smtp-test-password",
  EMAIL_FROM: "Il Tecnico di Fiducia <mailer@example.test>",
  SUPPORT_ADMIN_EMAIL: "support@example.test",
};

function runValidator(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    ...validRequiredEnv,
  };

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }
  }

  return spawnSync(process.execPath, [validatorPath], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
}

describe("production environment contract", () => {
  it("accepts a complete valid production configuration", () => {
    const result = runValidator();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Configurazione production completa e formalmente valida.",
    );
  });

  it("fails when a required production variable is missing", () => {
    const result = runValidator({
      NEXT_PUBLIC_SITE_URL: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("❌ NEXT_PUBLIC_SITE_URL");
    expect(result.stdout).toContain(
      "Mancano 1 variabili obbligatorie per la production.",
    );
  });

  it("does not require STRIPE_RECONCILE_SECRET", () => {
    const result = runValidator({
      STRIPE_RECONCILE_SECRET: undefined,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "ℹ️ non configurata STRIPE_RECONCILE_SECRET",
    );
  });

  it("does not require the manual initial admin variables", () => {
    const result = runValidator({
      INITIAL_ADMIN_EMAIL: undefined,
      INITIAL_ADMIN_TEMP_PASSWORD: undefined,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ℹ️ non configurata INITIAL_ADMIN_EMAIL");
    expect(result.stdout).toContain(
      "ℹ️ non configurata INITIAL_ADMIN_TEMP_PASSWORD",
    );
  });

  it("rejects a malformed public site URL", () => {
    const result = runValidator({
      NEXT_PUBLIC_SITE_URL: "not-a-url",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("FORMATO NON VALIDO");
    expect(result.stdout).toContain("❌ NEXT_PUBLIC_SITE_URL");
  });

  it("requires HTTPS for the Supabase URL", () => {
    const result = runValidator({
      NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("❌ NEXT_PUBLIC_SUPABASE_URL");
  });

  it("rejects an invalid SMTP port", () => {
    const result = runValidator({
      SMTP_PORT: "99999",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("❌ SMTP_PORT");
  });

  it("rejects an invalid SMTP_SECURE value", () => {
    const result = runValidator({
      SMTP_SECURE: "maybe",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("❌ SMTP_SECURE");
  });
});

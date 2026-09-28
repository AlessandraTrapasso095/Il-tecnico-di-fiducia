import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const webhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");

const reconcile = readFileSync("src/app/api/stripe/reconcile/route.ts", "utf8");

const suggestions = readFileSync(
  "src/lib/server/profession-suggestions.ts",
  "utf8",
);

const migration = readFileSync(
  "supabase/migrations/20260924113000_stripe_webhook_hardening.sql",
  "utf8",
);

describe("Stripe webhook production hardening contract", () => {
  it("propagates Stripe event identity and creation time", () => {
    expect(webhook.match(/stripeEventId: event\.id/g)?.length).toBe(3);

    expect(webhook.match(/stripeEventCreated: event\.created/g)?.length).toBe(
      2,
    );
  });

  it("reconcile supplies monotonic event metadata", () => {
    expect(reconcile).toContain(
      "const reconcileTimestamp = Math.floor(Date.now() / 1000)",
    );

    expect(reconcile).toContain("stripeEventCreated: reconcileTimestamp");

    expect(reconcile).toContain(
      "stripeEventId: `reconcile:${subscription.id}:${reconcileTimestamp}`",
    );
  });

  it("routes reconcile not-found through the atomic Stripe RPC helper", () => {
    expect(reconcile).toMatch(
      /applyProfessionalSubscriptionStateFromStripe\(\s*service\s*,/,
    );

    expect(reconcile).toContain('status: "none"');
    expect(reconcile).toContain("stripeSubscriptionId: null");
    expect(reconcile).toContain("currentPeriodEnd: null");

    expect(reconcile).toContain(
      "stripeEventId: `reconcile:not-found:${subscriptionId}:${reconcileTimestamp}`",
    );

    expect(reconcile).not.toContain(
      '.from("professional_subscriptions")\n            .update({',
    );
  });

  it("uses atomic event ordering and unique Stripe identifiers", () => {
    expect(migration).toContain(
      "create or replace function public.apply_stripe_subscription_event",
    );

    expect(migration).toContain("excluded.stripe_last_event_created >");

    expect(migration).toContain(
      "professional_subscriptions_stripe_subscription_uidx",
    );

    expect(migration).toContain(
      "professional_subscriptions_stripe_customer_uidx",
    );

    expect(migration).toContain(
      "excluded.stripe_last_event_id is distinct from",
    );

    expect(migration).not.toContain(
      "excluded.stripe_last_event_id =\n        public.professional_subscriptions.stripe_last_event_id",
    );

    expect(migration).toContain(
      "grant execute on function public.apply_stripe_subscription_event",
    );
  });

  it("retries only undelivered profession suggestion emails", () => {
    expect(suggestions).toContain(".insert(suggestion as never)");
    expect(suggestions).toContain('error.code === "23505"');

    expect(suggestions).toContain(
      '.eq("stripe_checkout_session_id", session.id)',
    );

    expect(suggestions).toContain("admin_email_sent_at");
    expect(suggestions).toContain("user_email_sent_at");

    expect(suggestions).toContain('"claim_profession_suggestion_email"');

    expect(suggestions).toContain('"complete_profession_suggestion_email"');

    expect(suggestions).toContain("if (alreadySentAt)");
    expect(suggestions).toContain("if (!result.sent)");

    expect(suggestions).not.toContain("Promise.allSettled");
    expect(suggestions).not.toContain(
      '.upsert(suggestion as never, { onConflict: "stripe_checkout_session_id" })',
    );
  });
});

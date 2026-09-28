import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mapStripeSubscriptionStatus } from "@/lib/stripe-subscription-status";

const helper = readFileSync("src/lib/server/stripe-subscriptions.ts", "utf8");

describe("Stripe subscription hardening", () => {
  it.each([
    ["active", "stripe_active"],
    ["trialing", "stripe_active"],
    ["past_due", "suspended"],
    ["unpaid", "suspended"],
    ["paused", "suspended"],
    ["canceled", "none"],
    ["incomplete", "none"],
    ["incomplete_expired", "none"],
  ] as const)("maps %s to %s", (stripeStatus, expected) => {
    expect(mapStripeSubscriptionStatus(stripeStatus)).toBe(expected);
  });

  it("uses the atomic Stripe subscription event RPC", () => {
    expect(helper).toContain('"apply_stripe_subscription_event"');
    expect(helper).toContain("target_stripe_event_id: args.stripeEventId");
    expect(helper).toContain(
      "target_stripe_event_created: args.stripeEventCreated",
    );
    expect(helper).toContain("applied: Boolean(row.applied)");
  });
});

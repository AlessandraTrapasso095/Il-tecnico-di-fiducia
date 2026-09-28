import "server-only";

import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripe() {
  if (cachedStripe) return cachedStripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing env: STRIPE_SECRET_KEY");
  }

  cachedStripe = new Stripe(secretKey, {
    // Keep Stripe in TS mode; API version is managed in your Stripe dashboard.
    typescript: true,
  });

  return cachedStripe;
}

export type ProfessionalSubscriptionPlan = "monthly" | "annual";

export function getStripeProfessionalPriceId(
  plan: ProfessionalSubscriptionPlan,
) {
  const envName =
    plan === "annual"
      ? "STRIPE_PRO_ANNUAL_PRICE_ID"
      : "STRIPE_PRO_MONTHLY_PRICE_ID";

  const priceId = process.env[envName];

  if (!priceId) {
    throw new Error(`Missing env: ${envName}`);
  }

  return priceId;
}

export function getStripeProfessionSuggestionPriceId() {
  const priceId = process.env.STRIPE_PROFESSION_SUGGESTION_PRICE_ID;
  if (!priceId) {
    throw new Error("Missing env: STRIPE_PROFESSION_SUGGESTION_PRICE_ID");
  }
  return priceId;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing env: STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

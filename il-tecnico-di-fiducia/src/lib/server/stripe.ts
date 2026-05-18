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

export function getStripeProfessionalPriceId() {
  const priceId = process.env.STRIPE_PRO_SUBSCRIPTION_PRICE_ID;
  if (!priceId) {
    throw new Error("Missing env: STRIPE_PRO_SUBSCRIPTION_PRICE_ID");
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


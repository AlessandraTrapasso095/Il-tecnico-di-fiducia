import type Stripe from "stripe";

export type AppSubscriptionStatus =
  "none" | "stripe_active" | "admin_forced_active" | "suspended";

export function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
): Exclude<AppSubscriptionStatus, "admin_forced_active"> {
  if (stripeStatus === "active" || stripeStatus === "trialing") {
    return "stripe_active";
  }

  if (
    stripeStatus === "past_due" ||
    stripeStatus === "unpaid" ||
    stripeStatus === "paused"
  ) {
    return "suspended";
  }

  return "none";
}

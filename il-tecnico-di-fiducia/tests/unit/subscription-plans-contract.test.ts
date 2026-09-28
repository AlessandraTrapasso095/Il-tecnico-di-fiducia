import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const stripeServer = read("src/lib/server/stripe.ts");
const checkout = read("src/app/api/billing/checkout/route.ts");
const checkoutButton = read("src/components/billing/start-checkout-button.tsx");
const subscriptionPage = read(
  "src/app/professionista/impostazioni/abbonamento/subscription-settings-client.tsx",
);
const envExample = read(".env.example");
const productionValidator = read("scripts/check-production-env.mjs");

describe("professional subscription plans contract", () => {
  it("supports only monthly and annual professional plans", () => {
    expect(stripeServer).toContain(
      'ProfessionalSubscriptionPlan = "monthly" | "annual"',
    );

    expect(checkout).toContain(
      'payload.plan !== "monthly" && payload.plan !== "annual"',
    );
  });

  it("keeps Stripe price selection on the server", () => {
    expect(checkoutButton).toContain("body: JSON.stringify({ plan })");

    expect(checkoutButton).not.toContain("price_");

    expect(checkout).toContain("getStripeProfessionalPriceId(plan)");
  });

  it("uses dedicated monthly and annual env vars", () => {
    expect(stripeServer).toContain('"STRIPE_PRO_MONTHLY_PRICE_ID"');

    expect(stripeServer).toContain('"STRIPE_PRO_ANNUAL_PRICE_ID"');

    expect(envExample).toContain("STRIPE_PRO_MONTHLY_PRICE_ID=");

    expect(envExample).toContain("STRIPE_PRO_ANNUAL_PRICE_ID=");

    expect(productionValidator).toContain("STRIPE_PRO_MONTHLY_PRICE_ID");

    expect(productionValidator).toContain("STRIPE_PRO_ANNUAL_PRICE_ID");
  });

  it("shows the launch prices and both plan CTAs", () => {
    expect(subscriptionPage).toContain("€9,99");
    expect(subscriptionPage).toContain("€99,99");

    expect(subscriptionPage).toContain('plan="monthly"');
    expect(subscriptionPage).toContain('plan="annual"');

    expect(subscriptionPage).toContain("Scegli mensile");
    expect(subscriptionPage).toContain("Scegli annuale");
  });
});

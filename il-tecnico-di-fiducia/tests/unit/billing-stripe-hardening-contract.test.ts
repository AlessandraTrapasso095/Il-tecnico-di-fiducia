import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const checkout = read("src/app/api/billing/checkout/route.ts");
const portal = read("src/app/api/billing/portal/route.ts");
const adminSubscription = read(
  "src/app/api/admin/professionals/[id]/subscription/route.ts",
);
const supportAdmin = read("src/app/admin/supporto/support-client.tsx");

describe("Stripe billing production hardening contract", () => {
  it("does not blindly create a second Stripe subscription", () => {
    expect(checkout).toContain(
      '.select("stripe_customer_id, stripe_subscription_id")',
    );

    expect(checkout).toContain(
      "stripe.subscriptions.retrieve(stripeSubscriptionId)",
    );

    expect(checkout).toContain("EXISTING_SUBSCRIPTION_STATUSES");

    expect(checkout).toContain("stripe.billingPortal.sessions.create");

    expect(checkout).toContain(
      "return_url: `${baseUrl}/professionista/abbonamento`",
    );
  });

  it("keeps checkout price and professional identity server controlled", () => {
    expect(checkout).toContain(
      "const priceId = getStripeProfessionalPriceId(plan)",
    );

    expect(checkout).toContain(
      'payload.plan !== "monthly" && payload.plan !== "annual"',
    );

    expect(checkout).toContain("client_reference_id: user.id");

    expect(checkout).toContain("professional_id: user.id");

    expect(checkout).toContain("line_items: [{ price: priceId, quantity: 1 }]");
  });

  it("does not expose raw Stripe portal errors", () => {
    expect(portal).toContain('logApiError("BILLING_PORTAL ERROR"');

    expect(portal).toContain(
      "Non è stato possibile aprire la gestione dell’abbonamento. Riprova.",
    );

    expect(portal).not.toContain("return NextResponse.json({ error: message }");

    expect(portal).toContain(
      "return_url: `${baseUrl}/professionista/abbonamento`",
    );
  });

  it("prevents an admin from erasing a Stripe-backed subscription", () => {
    expect(adminSubscription).toContain(
      '.select("status, stripe_customer_id, stripe_subscription_id")',
    );

    expect(adminSubscription).toContain(
      "existingSubscription?.stripe_subscription_id",
    );

    expect(adminSubscription).toContain('payload.status === "none"');

    expect(adminSubscription).toContain(
      'payload.status === "admin_forced_active"',
    );

    expect(adminSubscription).toContain("{ status: 409 }");
  });

  it("suspends rather than erasing Stripe subscriptions from support admin", () => {
    expect(supportAdmin).toContain(
      'user.subscription?.status === "admin_forced_active"',
    );

    expect(supportAdmin).toMatch(/\?\s*"none"\s*:\s*"suspended"/);

    expect(supportAdmin).toContain('"Sospendi accesso"');
  });
});

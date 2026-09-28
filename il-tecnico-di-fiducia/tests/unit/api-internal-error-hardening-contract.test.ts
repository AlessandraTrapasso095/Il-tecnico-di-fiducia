import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const helper = readFileSync("src/lib/api/internal-server-error.ts", "utf8");

const account = readFileSync("src/app/api/account/route.ts", "utf8");

const adminUsers = readFileSync(
  "src/app/api/admin/users/[id]/route.ts",
  "utf8",
);

const admins = readFileSync("src/app/api/admin/admins/route.ts", "utf8");

const discounts = readFileSync(
  "src/app/api/admin/subscription-discounts/[id]/route.ts",
  "utf8",
);

describe("API internal error hardening contract", () => {
  it("logs internal details server-side and returns a generic 500", () => {
    expect(helper).toContain("logApiError");
    expect(helper).toContain("status: 500");

    expect(helper).toContain(
      "Si è verificato un problema interno. Riprova tra qualche istante.",
    );
  });

  it("hardens account deletion internal failures", () => {
    expect(account).toContain("internalServerError");

    expect(account).not.toContain(
      "return NextResponse.json({ error: deleteError.message }, { status: 500 })",
    );

    expect(account).not.toContain("Failed to initialize service client");

    expect(account).not.toContain("Storage cleanup failed");
  });

  it("hardens admin user internal failures", () => {
    expect(adminUsers).toContain("internalServerError");

    expect(adminUsers).not.toContain(
      "return NextResponse.json({ error: deleteError.message }, { status: 500 })",
    );

    expect(adminUsers).not.toContain("Failed to initialize service client");

    expect(adminUsers).not.toContain("Storage cleanup failed");
  });

  it("hardens admin creation internal failures", () => {
    expect(admins).toContain("internalServerError");

    expect(admins).not.toContain(
      "return NextResponse.json({ error: profileError.message }, { status: 500 })",
    );

    expect(admins).not.toContain('error: "Failed to create admin user"');
  });

  it("hardens subscription discount internal failures", () => {
    expect(discounts).toContain("internalServerError");

    expect(discounts).not.toContain(
      "return NextResponse.json({ error: currentError.message }, { status: 500 })",
    );
  });

  it("does not expose Stripe reconcile exception details in 500 responses", () => {
    const reconcile = readFileSync(
      "src/app/api/stripe/reconcile/route.ts",
      "utf8",
    );

    expect(reconcile).toContain("STRIPE RECONCILE PROFESSIONAL ERROR");

    expect(reconcile).not.toContain("Reconcile failed for ${professionalId}");
  });

  it("does not expose discount database or Stripe exception details", () => {
    const discountList = readFileSync(
      "src/app/api/admin/subscription-discounts/route.ts",
      "utf8",
    );

    expect(discountList).toContain("ADMIN DISCOUNTS FALLBACK LOAD ERROR");

    expect(discountList).toContain("ADMIN DISCOUNT STRIPE CREATE ERROR");

    expect(discountList).not.toContain("message: fallback.error.message");

    expect(discountList).not.toContain("details: fallback.error.details");

    expect(discountList).not.toContain("hint: fallback.error.hint");

    expect(discountList).not.toContain(
      "error instanceof Error ? error.message",
    );
  });

  it("does not expose storage cleanup errors in post APIs", () => {
    const postRoute = readFileSync("src/app/api/posts/[id]/route.ts", "utf8");

    const attachmentRoute = readFileSync(
      "src/app/api/posts/[id]/attachments/[attachmentId]/route.ts",
      "utf8",
    );

    expect(postRoute).toContain("POST DELETE STORAGE CLEANUP ERROR");

    expect(postRoute).not.toContain(
      "storage cleanup failed: ${storageError.message}",
    );

    expect(attachmentRoute).toContain(
      "POST ATTACHMENT DELETE STORAGE CLEANUP ERROR",
    );

    expect(attachmentRoute).not.toContain(
      "storage cleanup failed: ${storageError.message}",
    );
  });

  it("does not expose Stripe webhook processing exceptions", () => {
    const webhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");

    expect(webhook).toContain("STRIPE WEBHOOK SERVICE CLIENT ERROR");

    expect(webhook).toContain("STRIPE WEBHOOK PROCESSING ERROR");

    expect(webhook).not.toContain('"Failed to process Stripe webhook";');

    expect(webhook).not.toContain('"Failed to initialize service client";');
  });

  it("does not globally remove useful 4xx API messages", () => {
    expect(admins).toContain(
      "return NextResponse.json({ error: error.message }, { status: 400 })",
    );

    expect(discounts).toContain('error: "Codice sconto non trovato."');
    expect(discounts).toContain("status: 404");
  });
});

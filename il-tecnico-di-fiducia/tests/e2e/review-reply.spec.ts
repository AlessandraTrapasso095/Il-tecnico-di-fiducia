import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { e2eConfig, hasAuthenticatedE2EConfig, login } from "./auth-helpers";

type ReviewConversation = {
  id: string;
  request_id: string;
};

async function reviewConversation(): Promise<ReviewConversation> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const professionalId = process.env.E2E_PROFESSIONAL_ID;

  if (!url || !serviceRoleKey || !customerEmail || !professionalId) {
    throw new Error("Configurazione E2E/Supabase incompleta.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: customer, error: customerError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", customerEmail)
    .maybeSingle();

  if (customerError || !customer) {
    throw new Error(
      customerError?.message ?? "Profilo customer E2E non trovato.",
    );
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, request_id")
    .eq("customer_id", customer.id)
    .eq("professional_id", professionalId)
    .eq("status", "accepted")
    .not("request_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationError || !conversation || !conversation.request_id) {
    throw new Error(
      conversationError?.message ??
        "Nessuna conversazione E2E valida per la recensione.",
    );
  }

  const { data: existingReview, error: reviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("request_id", conversation.request_id)
    .maybeSingle();

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  if (existingReview) {
    throw new Error(
      "La richiesta E2E selezionata possiede già una recensione. Serve una richiesta E2E non ancora recensita.",
    );
  }

  return {
    id: conversation.id,
    request_id: conversation.request_id,
  };
}

async function authenticatedPage(
  context: BrowserContext,
  credentials: { email: string; password: string },
  role: "customer" | "professional",
): Promise<Page> {
  const page = await context.newPage();
  await login(page, credentials, role);
  return page;
}

async function openReviewsTab(page: Page) {
  const reviewButton = page
    .getByRole("button")
    .filter({ hasText: "Recensioni" })
    .first();

  if (await reviewButton.count()) {
    await reviewButton.click();
  }

  await expect(
    page.getByRole("heading", {
      name: "Recensioni",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("review + professional reply", () => {
  test.skip(
    !hasAuthenticatedE2EConfig(),
    "Authenticated E2E credentials are not configured.",
  );

  test("customer reviews professional and professional replies once", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const config = e2eConfig();
    const conversation = await reviewConversation();

    const customerContext = await browser.newContext();
    const professionalContext = await browser.newContext();

    const timestamp = Date.now();
    const reviewTitle = `E2E recensione ${timestamp}`;
    const reviewBody = `Recensione automatizzata E2E ${timestamp} per verificare il flusso cliente-professionista.`;
    const replyBody = `Risposta automatizzata E2E ${timestamp} del professionista.`;

    try {
      const customerPage = await authenticatedPage(
        customerContext,
        config.customer,
        "customer",
      );

      await customerPage.goto(
        `/customer?section=messages&conversation=${conversation.id}`,
      );

      await expect(
        customerPage.getByPlaceholder("Scrivi un messaggio…"),
      ).toBeVisible({ timeout: 15_000 });

      await customerPage
        .getByRole("button", {
          name: "Lascia una recensione",
          exact: true,
        })
        .click();

      await expect(
        customerPage.getByRole("heading", {
          name: "Lascia una recensione",
          exact: true,
        }),
      ).toBeVisible();

      await customerPage
        .getByRole("button", {
          name: "5 stelle",
          exact: true,
        })
        .click();

      await customerPage
        .getByPlaceholder("Es. Intervento preciso e puntuale")
        .fill(reviewTitle);

      await customerPage
        .getByPlaceholder(
          "Racconta la tua esperienza reale con il professionista…",
        )
        .fill(reviewBody);

      const createReviewResponsePromise = customerPage.waitForResponse(
        (response) =>
          response.url().includes("/api/reviews") &&
          response.request().method() === "POST" &&
          !response.url().includes("/reply"),
      );

      await customerPage
        .getByRole("button", {
          name: "Invia recensione",
          exact: true,
        })
        .click();

      const createReviewResponse = await createReviewResponsePromise;
      expect(createReviewResponse.ok()).toBeTruthy();

      await expect(
        customerPage.getByRole("heading", {
          name: "Lascia una recensione",
          exact: true,
        }),
      ).toHaveCount(0);

      const professionalPage = await authenticatedPage(
        professionalContext,
        config.professional,
        "professional",
      );

      await professionalPage.goto(`/professionisti/${config.professionalId}`);

      await openReviewsTab(professionalPage);

      const ownerReview = professionalPage
        .locator("article")
        .filter({ hasText: reviewTitle })
        .first();

      await expect(ownerReview).toBeVisible({ timeout: 15_000 });
      await expect(
        ownerReview.getByText(reviewBody, { exact: true }),
      ).toBeVisible();

      const replyInput = ownerReview.getByPlaceholder(
        "Rispondi a questa recensione...",
      );

      await expect(replyInput).toBeVisible();
      await replyInput.fill(replyBody);

      const replyResponsePromise = professionalPage.waitForResponse(
        (response) =>
          response.url().includes("/api/reviews/") &&
          response.url().includes("/reply") &&
          response.request().method() === "POST",
      );

      await ownerReview
        .getByRole("button", {
          name: /Rispondi/,
        })
        .click();

      const replyResponse = await replyResponsePromise;
      expect(replyResponse.ok()).toBeTruthy();

      await expect(
        ownerReview.getByText("Risposta del professionista", {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15_000 });

      await expect(
        ownerReview.getByText(replyBody, { exact: true }),
      ).toBeVisible();

      await expect(
        ownerReview.getByPlaceholder("Rispondi a questa recensione..."),
      ).toHaveCount(0);

      await customerPage.goto(`/professionisti/${config.professionalId}`);

      await openReviewsTab(customerPage);

      const customerReview = customerPage
        .locator("article")
        .filter({ hasText: reviewTitle })
        .first();

      await expect(customerReview).toBeVisible({ timeout: 15_000 });

      await expect(
        customerReview.getByText(reviewBody, { exact: true }),
      ).toBeVisible();

      await expect(
        customerReview.getByText("Risposta del professionista", {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        customerReview.getByText(replyBody, { exact: true }),
      ).toBeVisible();

      await expect(
        customerReview.getByPlaceholder("Rispondi a questa recensione..."),
      ).toHaveCount(0);
    } finally {
      await customerContext.close();
      await professionalContext.close();
    }
  });
});

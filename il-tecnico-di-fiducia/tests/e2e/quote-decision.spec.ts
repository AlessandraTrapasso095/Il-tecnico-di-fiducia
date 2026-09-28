import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { e2eConfig, hasAuthenticatedE2EConfig, login } from "./auth-helpers";

type AcceptedConversation = {
  id: string;
};

async function latestAcceptedConversation(): Promise<AcceptedConversation> {
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
    .select("id")
    .eq("customer_id", customer.id)
    .eq("professional_id", professionalId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationError || !conversation) {
    throw new Error(
      conversationError?.message ??
        "Nessuna conversazione E2E accepted disponibile.",
    );
  }

  return conversation;
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

test.describe("quote decision", () => {
  test.skip(
    !hasAuthenticatedE2EConfig(),
    "Authenticated E2E credentials are not configured.",
  );

  test("professional sends a quote and customer accepts it", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const config = e2eConfig();
    const conversation = await latestAcceptedConversation();

    const professionalContext = await browser.newContext();
    const customerContext = await browser.newContext();

    const timestamp = Date.now();
    const description = `E2E preventivo ${timestamp}`;
    const amount = "123.45";

    try {
      const professionalPage = await authenticatedPage(
        professionalContext,
        config.professional,
        "professional",
      );

      const customerPage = await authenticatedPage(
        customerContext,
        config.customer,
        "customer",
      );

      await professionalPage.goto(
        `/professionista/messaggi?conversation=${conversation.id}`,
      );

      await expect(
        professionalPage.getByPlaceholder("Scrivi un messaggio…"),
      ).toBeVisible({ timeout: 15_000 });

      await professionalPage
        .getByRole("button", {
          name: "Invia preventivo",
          exact: true,
        })
        .first()
        .click();

      await expect(
        professionalPage.getByRole("heading", {
          name: "Invia preventivo",
          exact: true,
        }),
      ).toBeVisible();

      await professionalPage
        .getByRole("textbox", {
          name: "Descrizione preventivo",
          exact: true,
        })
        .fill(description);

      await professionalPage
        .getByRole("spinbutton", {
          name: "Prezzo",
          exact: true,
        })
        .fill(amount);

      const quoteResponsePromise = professionalPage.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/conversations/${conversation.id}/quotes`) &&
          response.request().method() === "POST",
      );

      await professionalPage
        .getByRole("button", {
          name: "Invia preventivo",
          exact: true,
        })
        .last()
        .click();

      const quoteResponse = await quoteResponsePromise;
      expect(quoteResponse.ok()).toBeTruthy();

      await expect(
        professionalPage
          .getByRole("button")
          .filter({ hasText: "Preventivo inviato" })
          .last(),
      ).toBeVisible({ timeout: 15_000 });

      await customerPage.goto(
        `/customer?section=messages&conversation=${conversation.id}`,
      );

      await expect(
        customerPage.getByPlaceholder("Scrivi un messaggio…"),
      ).toBeVisible({ timeout: 15_000 });

      await customerPage.reload();

      await expect(
        customerPage.getByPlaceholder("Scrivi un messaggio…"),
      ).toBeVisible({ timeout: 15_000 });

      const customerQuoteCard = customerPage
        .getByRole("button")
        .filter({ hasText: "Ecco il tuo preventivo" })
        .last();

      await expect(customerQuoteCard).toBeVisible({ timeout: 15_000 });
      await customerQuoteCard.click();

      await expect(
        customerPage.getByText(description, { exact: true }),
      ).toBeVisible();

      await expect(
        customerPage.getByText("Stato: In attesa", { exact: true }),
      ).toBeVisible();

      const acceptResponsePromise = customerPage.waitForResponse(
        (response) =>
          response.url().includes("/api/quotes/") &&
          response.request().method() === "PATCH",
      );

      await customerPage
        .getByRole("button", { name: "Accetta", exact: true })
        .click();

      const acceptResponse = await acceptResponsePromise;
      expect(acceptResponse.ok()).toBeTruthy();

      await expect(
        customerPage.getByText("Stato: Accettato", { exact: true }),
      ).toBeVisible({ timeout: 15_000 });

      await professionalPage.reload();

      await expect(
        professionalPage.getByPlaceholder("Scrivi un messaggio…"),
      ).toBeVisible({ timeout: 15_000 });

      const professionalQuoteCard = professionalPage
        .getByRole("button")
        .filter({ hasText: "Preventivo inviato" })
        .last();

      await expect(professionalQuoteCard).toBeVisible({
        timeout: 15_000,
      });

      await professionalQuoteCard.click();

      await expect(
        professionalPage.getByText(description, { exact: true }),
      ).toBeVisible();

      await expect(
        professionalPage.getByText("Stato: Accettato", { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await professionalContext.close();
      await customerContext.close();
    }
  });
});

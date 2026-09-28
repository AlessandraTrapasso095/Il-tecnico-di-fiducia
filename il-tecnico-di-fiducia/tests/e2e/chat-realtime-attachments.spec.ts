import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { e2eConfig, hasAuthenticatedE2EConfig, login } from "./auth-helpers";

type AcceptedConversation = {
  id: string;
  customer_id: string;
  professional_id: string;
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
    .select("id, customer_id, professional_id")
    .eq("customer_id", customer.id)
    .eq("professional_id", professionalId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conversationError || !conversation) {
    throw new Error(
      conversationError?.message ??
        "Nessuna conversazione E2E accepted disponibile. Esegui prima l'E2E 8.4.",
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

test.describe("chat realtime + attachments", () => {
  test.skip(
    !hasAuthenticatedE2EConfig(),
    "Authenticated E2E credentials are not configured.",
  );

  test("customer and professional exchange realtime messages and an attachment", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const config = e2eConfig();
    const conversation = await latestAcceptedConversation();

    const professionalContext = await browser.newContext();
    const customerContext = await browser.newContext();

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

      await customerPage.goto(
        `/customer?section=messages&conversation=${conversation.id}`,
      );

      const professionalComposer = professionalPage.getByPlaceholder(
        "Scrivi un messaggio…",
      );
      const customerComposer = customerPage.getByPlaceholder(
        "Scrivi un messaggio…",
      );

      await expect(professionalComposer).toBeVisible({ timeout: 15_000 });
      await expect(customerComposer).toBeVisible({ timeout: 15_000 });

      const professionalMessage = `E2E realtime professionista ${Date.now()}`;

      await professionalComposer.fill(professionalMessage);

      const professionalSendResponse = professionalPage.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/conversations/${conversation.id}/messages`) &&
          response.request().method() === "POST",
      );

      await professionalPage
        .locator('button[type="submit"][title="Invia"]')
        .click();

      const sentByProfessional = await professionalSendResponse;
      expect(sentByProfessional.ok()).toBeTruthy();

      await expect(
        customerPage
          .getByRole("paragraph")
          .filter({ hasText: professionalMessage })
          .last(),
      ).toBeVisible({ timeout: 15_000 });

      const customerMessage = `E2E realtime cliente ${Date.now()}`;

      await customerComposer.fill(customerMessage);

      const customerSendResponse = customerPage.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/conversations/${conversation.id}/messages`) &&
          response.request().method() === "POST",
      );

      await customerPage
        .locator('button[type="submit"][title="Invia"]')
        .click();

      const sentByCustomer = await customerSendResponse;
      expect(sentByCustomer.ok()).toBeTruthy();

      await expect(
        professionalPage
          .getByRole("paragraph")
          .filter({ hasText: customerMessage })
          .last(),
      ).toBeVisible({ timeout: 15_000 });

      const attachmentMessage = `E2E allegato ${Date.now()}`;
      const attachmentName = `e2e-chat-${Date.now()}.png`;

      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      );

      await professionalComposer.fill(attachmentMessage);

      const fileInput = professionalPage.locator(
        'input[type="file"][multiple]',
      );

      await fileInput.setInputFiles({
        name: attachmentName,
        mimeType: "image/png",
        buffer: png,
      });

      await expect(
        professionalPage.getByLabel(`Rimuovi ${attachmentName}`),
      ).toBeVisible({ timeout: 10_000 });

      const attachmentSendResponse = professionalPage.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/conversations/${conversation.id}/messages`) &&
          response.request().method() === "POST",
      );

      await professionalPage
        .locator('button[type="submit"][title="Invia"]')
        .click();

      const sentAttachment = await attachmentSendResponse;
      expect(sentAttachment.ok()).toBeTruthy();

      await expect(
        professionalPage
          .getByRole("paragraph")
          .filter({ hasText: attachmentMessage })
          .last(),
      ).toBeVisible({ timeout: 15_000 });

      await expect(professionalPage.getByAltText(attachmentName)).toBeVisible({
        timeout: 15_000,
      });

      // Realtime bidirezionale è già verificato sopra con messaggi testuali.
      // Gli allegati vengono persistiti dopo l'INSERT del messaggio:
      // qui verifichiamo il contratto definitivo dopo una nuova lettura server.
      await customerPage.reload();

      await expect(
        customerPage.getByPlaceholder("Scrivi un messaggio…"),
      ).toBeVisible({ timeout: 15_000 });

      await expect(
        customerPage
          .getByRole("paragraph")
          .filter({ hasText: attachmentMessage })
          .last(),
      ).toBeVisible({ timeout: 15_000 });

      await expect(customerPage.getByAltText(attachmentName)).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await professionalContext.close();
      await customerContext.close();
    }
  });
});

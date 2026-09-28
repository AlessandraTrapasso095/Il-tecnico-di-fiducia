import { expect, test } from "@playwright/test";

import {
  e2eConfig,
  hasAuthenticatedE2EConfig,
  login,
  logout,
} from "./auth-helpers";

test.describe("customer → contact request → professional", () => {
  test.skip(
    !hasAuthenticatedE2EConfig(),
    "Authenticated E2E credentials are not configured.",
  );

  test("customer creates a request and professional accepts it", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const config = e2eConfig();
    const subject = `E2E richiesta ${Date.now()}`;
    const message =
      "Richiesta automatizzata Playwright per validare il flusso cliente-professionista.";

    await login(page, config.customer, "customer");

    await page.goto(`/professionisti/${config.professionalId}`);

    await page
      .getByRole("button", { name: /Contatta/ })
      .first()
      .click();

    await page
      .getByPlaceholder("Es. Rifacimento impianto elettrico")
      .fill(subject);

    await page
      .getByPlaceholder("Descrivi brevemente la tua necessità…")
      .fill(message);

    await page.getByRole("checkbox").check();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/contact-requests") &&
        response.request().method() === "POST" &&
        !response.url().includes("/attachments"),
    );

    await page.getByRole("button", { name: "Invia richiesta" }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();

    await expect(
      page.getByText("Richiesta inviata", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Chiudi", exact: true })
      .last()
      .click();

    await logout(page);

    await login(page, config.professional, "professional");

    await page.goto("/professionista/messaggi");

    const search = page.getByPlaceholder("Cerca conversazione…");
    await search.fill(subject);

    const conversation = page.getByRole("button").filter({
      hasText: message,
    });

    await expect(conversation.first()).toBeVisible({ timeout: 10_000 });
    await conversation.first().click();

    await expect(page.getByText(subject, { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "La richiesta è in attesa: accettala per abilitare la chat.",
      ),
    ).toBeVisible();

    const acceptResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/contact-requests/") &&
        response.request().method() === "PATCH",
    );

    await page.getByRole("button", { name: "Accetta richiesta" }).click();

    const acceptResponse = await acceptResponsePromise;
    expect(acceptResponse.ok()).toBeTruthy();

    await expect(
      page.getByText(
        "La richiesta è in attesa: accettala per abilitare la chat.",
      ),
    ).toHaveCount(0);

    await expect(
      page.getByText("Accettata", { exact: true }).last(),
    ).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { e2eConfig, login, loginAdmin } from "./auth-helpers";

test("professional support ticket and admin bidirectional workflow", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configurazione Supabase E2E incompleta.");
  }

  const config = e2eConfig();

  if (
    !config.professional.email ||
    !config.professional.password ||
    !config.admin.email ||
    !config.admin.password
  ) {
    throw new Error("Credenziali E2E professional/admin incomplete.");
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: professional, error: professionalError } = await service
    .from("profiles")
    .select("id")
    .eq("email", config.professional.email)
    .maybeSingle();

  if (professionalError || !professional) {
    throw new Error(
      professionalError?.message ?? "Professionista E2E non trovato.",
    );
  }

  const { data: admin, error: adminError } = await service
    .from("profiles")
    .select("id")
    .eq("email", config.admin.email)
    .maybeSingle();

  if (adminError || !admin) {
    throw new Error(adminError?.message ?? "Admin E2E non trovato.");
  }

  const stamp = Date.now();

  const subject = `E2E supporto ${stamp}`;
  const initialBody = `Richiesta iniziale supporto E2E ${stamp}`;
  const adminReply = `Risposta admin E2E ${stamp}`;
  const professionalReply = `Replica professionista E2E ${stamp}`;

  const { data: ticket, error: ticketError } = await service
    .from("support_tickets")
    .insert({
      author_id: professional.id,
      subject,
      body: initialBody,
      status: "open",
    })
    .select("id, status")
    .single();

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message ?? "Creazione ticket E2E fallita.");
  }

  const professionalContext = await browser.newContext();
  const adminContext = await browser.newContext();

  const professionalPage = await professionalContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    //
    // 1. PROFESSIONISTA VEDE IL TICKET
    //
    await login(professionalPage, config.professional, "professional");

    await professionalPage.goto(`/professionista/supporto?ticket=${ticket.id}`);

    await expect(
      professionalPage.getByRole("heading", {
        level: 2,
        name: subject,
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      professionalPage.getByText(initialBody, { exact: true }).last(),
    ).toBeVisible();

    await expect(
      professionalPage.getByText("Aperto", { exact: true }).last(),
    ).toBeVisible();

    //
    // 2. ADMIN LOGIN + VEDE IL TICKET
    //
    await loginAdmin(adminPage, config.admin);

    await adminPage.goto("/admin/supporto");

    const adminTicketButton = adminPage
      .getByRole("button", { name: new RegExp(subject) })
      .first();

    await expect(adminTicketButton).toBeVisible({
      timeout: 15_000,
    });

    await adminTicketButton.click();

    await expect(
      adminPage.getByText(initialBody, { exact: true }).last(),
    ).toBeVisible();

    //
    // 3. ADMIN RISPONDE → WAITING
    //
    await adminPage.getByLabel("Risposta admin").fill(adminReply);

    const adminReplyResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes(`/api/support-tickets/${ticket.id}/messages`) &&
        response.request().method() === "POST",
    );

    await adminPage
      .getByRole("button", {
        name: "Invia risposta",
        exact: true,
      })
      .click();

    const adminReplyResult = await adminReplyResponse;

    expect(adminReplyResult.ok()).toBeTruthy();

    await expect(
      adminPage.getByText("Risposta inviata. Il ticket resta in attesa.", {
        exact: true,
      }),
    ).toBeVisible();

    //
    // 4. PROFESSIONISTA VEDE RISPOSTA ADMIN
    //
    await professionalPage.reload();

    await expect(
      professionalPage.getByText(adminReply, { exact: true }).last(),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      professionalPage.getByText("In attesa", { exact: true }).last(),
    ).toBeVisible();

    //
    // 5. PROFESSIONISTA REPLICA → TICKET TORNA OPEN
    //
    const professionalReplyInput = professionalPage.getByLabel(
      "Scrivi una risposta",
    );

    await professionalReplyInput.fill(professionalReply);

    const professionalReplyResponse = professionalPage.waitForResponse(
      (response) =>
        response.url().includes(`/api/support-tickets/${ticket.id}/messages`) &&
        response.request().method() === "POST",
    );

    await professionalPage
      .getByRole("button", {
        name: "Invia risposta",
        exact: true,
      })
      .click();

    const professionalReplyResult = await professionalReplyResponse;

    expect(professionalReplyResult.ok()).toBeTruthy();

    await expect(
      professionalPage.getByText("Risposta inviata all'assistenza.", {
        exact: true,
      }),
    ).toBeVisible();

    //
    // 6. ADMIN VEDE REPLICA UTENTE
    //
    await adminPage.goto("/admin/supporto");

    const reopenedTicketButton = adminPage
      .getByRole("button", { name: new RegExp(subject) })
      .first();

    await expect(reopenedTicketButton).toBeVisible({
      timeout: 15_000,
    });

    await reopenedTicketButton.click();

    await expect(
      adminPage
        .getByText(professionalReply, {
          exact: true,
        })
        .last(),
    ).toBeVisible({ timeout: 15_000 });

    //
    // 7. ADMIN RISOLVE IL TICKET
    //
    const resolveResponse = adminPage.waitForResponse(
      (response) =>
        response.url().includes(`/api/support-tickets/${ticket.id}`) &&
        !response.url().endsWith("/messages") &&
        response.request().method() === "PATCH",
    );

    await adminPage
      .getByRole("button", {
        name: "Segna come risolto",
        exact: true,
      })
      .click();

    const resolveResult = await resolveResponse;

    expect(resolveResult.ok()).toBeTruthy();

    await expect(
      adminPage.getByText("Ticket segnato come risolto.", {
        exact: true,
      }),
    ).toBeVisible();

    //
    // 8. PROFESSIONISTA VEDE STATO RISOLTO
    //
    await professionalPage.reload();

    await expect(
      professionalPage.getByText(
        "Questo ticket è stato risolto. Apri una nuova richiesta se hai bisogno di ulteriore supporto.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      professionalPage
        .getByText("Risolto", {
          exact: true,
        })
        .last(),
    ).toBeVisible();

    //
    // 9. DATABASE — STATO, MESSAGGI, NOTIFICHE
    //
    const { data: finalTicket, error: finalTicketError } = await service
      .from("support_tickets")
      .select("id, status")
      .eq("id", ticket.id)
      .single();

    expect(finalTicketError).toBeNull();
    expect(finalTicket?.status).toBe("closed");

    const { data: messages, error: messagesError } = await service
      .from("support_messages")
      .select("sender_id, sender_role, body")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true });

    expect(messagesError).toBeNull();

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sender_id: admin.id,
          sender_role: "admin",
          body: adminReply,
        }),
        expect.objectContaining({
          sender_id: professional.id,
          sender_role: "professional",
          body: professionalReply,
        }),
      ]),
    );

    const { data: professionalNotifications } = await service
      .from("notifications")
      .select("type, recipient_id, entity_id")
      .eq("recipient_id", professional.id)
      .eq("entity_type", "support_ticket")
      .eq("entity_id", ticket.id);

    expect(professionalNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "support_ticket_replied",
          recipient_id: professional.id,
          entity_id: ticket.id,
        }),
        expect.objectContaining({
          type: "support_ticket_resolved",
          recipient_id: professional.id,
          entity_id: ticket.id,
        }),
      ]),
    );

    const { data: adminNotifications } = await service
      .from("notifications")
      .select("type, recipient_id, entity_id")
      .eq("recipient_id", admin.id)
      .eq("entity_type", "support_ticket")
      .eq("entity_id", ticket.id);

    expect(adminNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "support_ticket_user_replied",
          recipient_id: admin.id,
          entity_id: ticket.id,
        }),
      ]),
    );
  } finally {
    await professionalContext.close();
    await adminContext.close();
  }
});

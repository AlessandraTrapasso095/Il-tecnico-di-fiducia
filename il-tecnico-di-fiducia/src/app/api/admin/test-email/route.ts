import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { maskEmailForLog, sendSmtpDiagnosticEmail } from "@/lib/server/email";

export const runtime = "nodejs";

type TestEmailPayload = {
  email?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorStatus(phase: string | null) {
  if (phase === "validazione") return 400;
  if (phase === "configurazione") return 503;
  return 502;
}

function htmlPage() {
  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test SMTP admin</title>
    <style>
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        background: #f6f7fb;
        color: #082b5f;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(100% - 32px, 520px);
        border: 1px solid #dbe2f9;
        border-radius: 28px;
        background: white;
        box-shadow: 0 24px 80px rgba(8, 43, 95, 0.14);
        padding: 32px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 6vw, 40px);
        line-height: 1.05;
      }
      p {
        margin: 0 0 24px;
        color: #526070;
        line-height: 1.6;
      }
      label {
        display: grid;
        gap: 8px;
        font-weight: 700;
      }
      input {
        min-height: 48px;
        border: 1px solid #cbd5e1;
        border-radius: 16px;
        padding: 0 16px;
        font: inherit;
      }
      button {
        width: 100%;
        min-height: 48px;
        margin-top: 20px;
        border: 0;
        border-radius: 999px;
        background: #ff8500;
        color: white;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Test SMTP</h1>
      <p>Invia una singola email diagnostica usando la configurazione SMTP Production. Accesso riservato agli admin.</p>
      <form method="post" action="/api/admin/test-email">
        <label>
          Email destinatario esterno
          <input name="email" type="email" autocomplete="email" required />
        </label>
        <button type="submit">Invia test SMTP</button>
      </form>
    </main>
  </body>
</html>`;
}

async function readRecipient(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const email = formData.get("email");
    return typeof email === "string" ? email.trim() : "";
  }

  const payload = (await request.json()) as TestEmailPayload;
  return typeof payload.email === "string" ? payload.email.trim() : "";
}

function mailListContains(list: string[], recipient: string) {
  const normalizedRecipient = recipient.trim().toLowerCase();
  return list.some((email) => email.trim().toLowerCase() === normalizedRecipient);
}

export async function GET() {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  return new Response(htmlPage(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  let recipient: string;
  try {
    recipient = await readRecipient(request);
  } catch {
    return NextResponse.json({ error: "Payload non valido." }, { status: 400 });
  }

  if (!EMAIL_RE.test(recipient)) {
    return NextResponse.json(
      { error: "Inserisci un indirizzo email valido." },
      { status: 400 },
    );
  }

  const result = await sendSmtpDiagnosticEmail({
    to: recipient,
    subject: "Test SMTP Il Tecnico di Fiducia",
    text: "Questa è un’email di test SMTP inviata da Vercel Production.",
  });
  const acceptedContainsRecipient = mailListContains(
    result.sendMail.accepted,
    recipient,
  );
  const deliveryCompleted =
    acceptedContainsRecipient && result.sendMail.rejected.length === 0;

  console.info("[admin/test-email] SMTP diagnostic completed", {
    admin_id: auth.ctx.user.id,
    recipient_masked: maskEmailForLog(recipient),
    verify_attempted: result.verify.attempted,
    verify_succeeded: result.verify.succeeded,
    sendmail_attempted: result.sendMail.attempted,
    sendmail_succeeded: result.sendMail.succeeded,
    accepted_count: result.sendMail.accepted.length,
    rejected_count: result.sendMail.rejected.length,
    pending_count: result.sendMail.pending.length,
    accepted_contains_recipient: acceptedContainsRecipient,
    delivery_completed: deliveryCompleted,
    response: result.sendMail.response,
    phase: result.phase,
    error_code: result.error?.code ?? null,
    error_command: result.error?.command ?? null,
    error_response_code: result.error?.responseCode ?? null,
    error_message: result.error?.message ?? null,
  });

  return NextResponse.json(
    {
      verify_succeeded: result.verify.succeeded,
      verify_attempted: result.verify.attempted,
      sendmail_executed: result.sendMail.attempted,
      messageId: result.sendMail.messageId,
      accepted: result.sendMail.accepted,
      rejected: result.sendMail.rejected,
      pending: result.sendMail.pending,
      envelope: result.sendMail.envelope,
      response: result.sendMail.response,
      accepted_contains_recipient: acceptedContainsRecipient,
      delivery_completed: deliveryCompleted,
      responseCode: result.error?.responseCode ?? result.sendMail.responseCode,
      command: result.error?.command ?? result.sendMail.command,
      error: result.error,
      phase: result.phase,
      config: result.config,
    },
    { status: result.error ? errorStatus(result.phase) : 200 },
  );
}

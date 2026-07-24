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

export async function POST(request: Request) {
  const auth = await requireAuth({ allowedRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  let payload: TestEmailPayload;
  try {
    payload = (await request.json()) as TestEmailPayload;
  } catch {
    return NextResponse.json({ error: "Payload non valido." }, { status: 400 });
  }

  const recipient = typeof payload.email === "string" ? payload.email.trim() : "";
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
      responseCode: result.error?.responseCode ?? result.sendMail.responseCode,
      command: result.error?.command ?? result.sendMail.command,
      error: result.error,
      phase: result.phase,
      config: result.config,
    },
    { status: result.error ? errorStatus(result.phase) : 200 },
  );
}

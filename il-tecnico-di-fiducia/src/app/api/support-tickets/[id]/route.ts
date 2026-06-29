import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/api/audit-log";
import { requireAuth } from "@/lib/api/auth";
import { loadAdminUserSummaries } from "@/lib/server/admin-user-summaries";
import { sendSupportTicketResolvedEmail } from "@/lib/server/support-ticket-emails";
import { createServiceClient } from "@/lib/supabase/service";

type UpdateTicketPayload = {
  subject?: string;
  body?: string;
  status?: "open" | "waiting" | "closed";
};

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load ticket" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = createServiceClient();
  let author = null;
  try {
    const authorsById = await loadAdminUserSummaries(service, [data.author_id]);
    author = authorsById.get(data.author_id) ?? null;
  } catch {
    author = null;
  }

  return NextResponse.json({ ticket: { ...data, author } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase, profile } = auth.ctx;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: UpdateTicketPayload;
  try {
    payload = (await request.json()) as UpdateTicketPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isOptionalString(payload.subject) || !isOptionalString(payload.body)) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  if (payload.status && profile.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can change ticket status" },
      { status: 403 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (payload.subject !== undefined) updates.subject = payload.subject.trim();
  if (payload.body !== undefined) updates.body = payload.body.trim();
  if (payload.status) {
    if (!["open", "waiting", "closed"].includes(payload.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = payload.status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", id)
    .select("id, author_id, subject, body, status, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (profile.role === "admin" && payload.status) {
    await writeAuditLog(supabase, {
      actorId: profile.id,
      action: "admin.update_support_ticket",
      targetType: "support_ticket",
      targetId: id,
      metadata: { status: payload.status },
    });

    if (payload.status === "closed") {
      const service = createServiceClient();
      const authorsById = await loadAdminUserSummaries(service, [data.author_id]).catch(
        () => new Map(),
      );
      const author = authorsById.get(data.author_id) ?? null;

      try {
        await service.from("notifications").insert({
          recipient_id: data.author_id,
          actor_id: profile.id,
          type: "support_ticket_resolved",
          entity_type: "support_ticket",
          entity_id: data.id,
        });
      } catch (err) {
        console.error("[support] Failed to create ticket resolved notification", err);
      }

      if (author) {
        try {
          await sendSupportTicketResolvedEmail({ ticket: data, author });
        } catch (err) {
          console.error("[support] Failed to send ticket resolved email", err);
        }
      }
    }
  }

  return NextResponse.json({ ticket: data });
}

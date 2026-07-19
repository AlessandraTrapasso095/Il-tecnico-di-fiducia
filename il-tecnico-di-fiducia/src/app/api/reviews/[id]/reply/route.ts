import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api/auth";
import { isNonEmptyString } from "@/lib/api/validation";
import { notifyReviewReplied } from "@/lib/server/review-notifications";
import { createServiceClient } from "@/lib/supabase/service";

type ReplyPayload = {
  body: string;
};

const ALREADY_REPLIED_MESSAGE = "Hai già risposto a questa recensione.";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ allowedRoles: ["professional"] });
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth.ctx;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let payload: Partial<ReplyPayload> | null;
  try {
    payload = (await request.json()) as Partial<ReplyPayload> | null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload || !isNonEmptyString(payload.body)) {
    return NextResponse.json(
      { error: "Scrivi una risposta prima di inviare." },
      { status: 400 },
    );
  }
  const replyBody = payload.body.trim();

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, professional_id, customer_id, rating, title, body, professional_reply, professional_replied_at")
    .eq("id", id)
    .maybeSingle();

  if (reviewError) {
    console.error("[reviews.reply] Failed to load review", {
      reviewId: id,
      userId: user.id,
      code: reviewError.code,
      message: reviewError.message,
      details: reviewError.details,
      hint: reviewError.hint,
    });
    return NextResponse.json(
      { error: "Recensione non caricata. Riprova tra poco." },
      { status: 500 },
    );
  }

  if (!review) {
    return NextResponse.json({ error: "Recensione non trovata." }, { status: 404 });
  }

  if (review.professional_id !== user.id) {
    return NextResponse.json(
      { error: "Non puoi rispondere a questa recensione." },
      { status: 403 },
    );
  }

  if (review.professional_reply || review.professional_replied_at) {
    return NextResponse.json(
      { error: ALREADY_REPLIED_MESSAGE },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({
      professional_reply: replyBody,
      professional_replied_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, professional_id, customer_id, rating, title, body, professional_reply, professional_replied_at")
    .single();

  if (error) {
    if (
      error.message.includes("review reply can only be created once") ||
      error.message.includes("review reply timestamp can only be created once")
    ) {
      return NextResponse.json(
        { error: ALREADY_REPLIED_MESSAGE },
        { status: 409 },
      );
    }

    if (error.code === "42501") {
      return NextResponse.json(
        { error: "Non puoi rispondere a questa recensione." },
        { status: 403 },
      );
    }

    console.error("[reviews.reply] Failed to save professional reply", {
      reviewId: id,
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "Risposta non salvata. Riprova tra poco." },
      { status: 500 },
    );
  }

  try {
    await notifyReviewReplied({
      service: createServiceClient(),
      review: data,
      replyBody,
    });
  } catch (notificationError) {
    console.error("[reviews.reply] Failed to start review reply side effects", {
      reviewId: id,
      userId: user.id,
      error: notificationError,
      message: notificationError instanceof Error ? notificationError.message : null,
      stack: notificationError instanceof Error ? notificationError.stack : null,
    });
  }

  return NextResponse.json({ review: data });
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RealtimePostgresChangesPayload } from "@supabase/realtime-js";

import { useAuthenticatedPresence } from "@/components/realtime/authenticated-presence";
import { ApiError, fetchJson } from "@/lib/api/fetch-json";
import type {
  ConversationDetailResponse,
  ConversationQuoteContext,
  ConversationQuotesResponse,
  ConversationRow,
  MeResponse,
  MessageRow,
  MessagesResponse,
  Participant,
  QuoteRow,
  RequestStatus,
} from "@/lib/types/chat";
import { createClient } from "@/lib/supabase/client";

type MessagesClientProps = {
  initialMe: MeResponse | null;
  initialMeError?: string | null;
  initialConversations: ConversationRow[];
  initialConversationsError?: string | null;
  initialActiveConversationId?: string | null;
  embedded?: boolean;
};

type ContactRequestSummary = {
  id: string;
  subject: string;
  message?: string | null;
  status: RequestStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

type RequestAttachment = {
  path: string;
  signed_url: string;
  expires_at: string;
  file_name: string;
  file_type: "image" | "video" | "document";
  mime_type: string | null;
  file_size: number | null;
};

type AttachmentsResponse = {
  attachments: RequestAttachment[];
};

type ReviewsMineResponse = {
  reviews: { id: string; request_id: string }[];
};

type TypingPayload = {
  user_id: string;
  is_typing: boolean;
};

function fullName(p: Participant | null | undefined) {
  if (!p) return "Utente";
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utente";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "In attesa";
    case "accepted":
      return "Accettata";
    case "rejected":
      return "Rifiutata";
    case "concluded":
    case "closed":
    case "completed":
      return "Conclusa";
    default:
      return status ?? "Sconosciuto";
  }
}

function statusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "bg-tertiary-fixed text-on-tertiary-fixed-variant";
    case "accepted":
      return "bg-primary-fixed text-on-primary-fixed-variant";
    case "rejected":
      return "bg-error-container text-on-error-container";
    case "concluded":
    case "closed":
    case "completed":
      return "bg-surface-container-high text-on-surface-variant";
    default:
      return "bg-surface-container-highest text-on-surface-variant";
  }
}

function quoteStatusLabel(status: string) {
  switch (status) {
    case "accepted":
      return "Accettato";
    case "rejected":
      return "Rifiutato";
    default:
      return "In attesa";
  }
}

function money(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function initials(person: { first_name?: string | null; last_name?: string | null } | null) {
  const first = person?.first_name?.trim().slice(0, 1).toUpperCase() ?? "";
  const last = person?.last_name?.trim().slice(0, 1).toUpperCase() ?? "";
  return `${first}${last}` || "U";
}

function isReadOnlyStatus(status: string | null | undefined) {
  return (
    status === "rejected" ||
    status === "concluded" ||
    status === "closed" ||
    status === "completed"
  );
}

function isUnavailableCustomerConversation(
  role: string | null,
  conversation: ConversationRow | null | undefined,
) {
  return role === "customer" && conversation?.professional_available === false;
}

function fileNameFromPath(path: string) {
  return decodeURIComponent(path.split("/").pop() ?? "allegato");
}

type ViewableAttachment = {
  id?: string;
  path?: string;
  signed_url: string;
  file_name?: string | null;
  file_type: "image" | "video" | "document";
  mime_type?: string | null;
};

function attachmentName(attachment: ViewableAttachment) {
  return attachment.file_name || (attachment.path ? fileNameFromPath(attachment.path) : "allegato");
}

function fileKindFromFile(file: File): "image" | "video" | "document" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sortMessagesByDate(items: MessageRow[]) {
  return [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function mergeMessage(current: MessageRow[], incoming: MessageRow) {
  const incomingAttachments = incoming.attachments ?? [];
  const normalized: MessageRow = {
    ...incoming,
    attachments: incomingAttachments,
  };
  const index = current.findIndex((message) => message.id === normalized.id);
  if (index === -1) {
    return sortMessagesByDate([...current, normalized]);
  }
  const next = [...current];
  next[index] = {
    ...next[index],
    ...normalized,
    attachments:
      incomingAttachments.length > 0 ? incomingAttachments : next[index].attachments ?? [],
  };
  return sortMessagesByDate(next);
}

function AttachmentPreview({
  attachment,
  mine,
  onOpen,
}: {
  attachment: ViewableAttachment;
  mine?: boolean;
  onOpen: (attachment: ViewableAttachment) => void;
}) {
  const name = attachmentName(attachment);

  if (attachment.file_type === "image") {
    return (
      <button
        type="button"
        className="mt-3 block max-w-[min(260px,70vw)] overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-left"
        onClick={() => onOpen(attachment)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.signed_url}
          alt={name}
          className="h-auto max-h-[320px] w-full max-w-[min(260px,70vw)] object-cover"
        />
      </button>
    );
  }

  if (attachment.file_type === "video") {
    return (
      <div
        className={[
          "mt-3 max-w-[min(300px,72vw)] overflow-hidden rounded-xl border bg-surface-container-lowest",
          mine ? "border-white/20" : "border-outline-variant/30",
        ].join(" ")}
      >
        <video
          src={attachment.signed_url}
          controls
          className="h-auto max-h-[320px] w-full max-w-[min(300px,72vw)] bg-inverse-surface object-contain"
        />
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-xs font-bold text-primary hover:bg-surface-container-low"
          onClick={() => onOpen(attachment)}
        >
          Apri video
        </button>
      </div>
    );
  }

  return (
    <a
      href={attachment.signed_url}
      target="_blank"
      rel="noreferrer"
      className={[
        "mt-3 flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
        mine
          ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
          : "border-outline-variant/30 bg-surface-container-lowest text-primary hover:bg-surface-container-low",
      ].join(" ")}
    >
      <span className="material-symbols-outlined" aria-hidden>
        description
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="material-symbols-outlined text-[18px]" aria-hidden>
        open_in_new
      </span>
    </a>
  );
}

function PendingFilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const kind = fileKindFromFile(file);
  const url = useMemo(
    () => (kind === "document" ? null : URL.createObjectURL(file)),
    [file, kind],
  );

  useEffect(() => {
    if (!url) return undefined;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
      <button
        type="button"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-inverse-surface/80 text-white"
        onClick={onRemove}
        aria-label={`Rimuovi ${file.name}`}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          close
        </span>
      </button>
      {kind === "image" && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="h-28 w-full object-cover" />
      ) : kind === "video" && url ? (
        <video src={url} className="h-28 w-full bg-inverse-surface object-contain" />
      ) : (
        <div className="flex h-28 flex-col items-center justify-center gap-2 px-3 text-center text-primary">
          <span className="material-symbols-outlined" aria-hidden>
            description
          </span>
          <span className="max-w-full truncate text-xs font-bold">{file.name}</span>
        </div>
      )}
    </div>
  );
}

function MediaViewer({
  attachment,
  onClose,
}: {
  attachment: ViewableAttachment;
  onClose: () => void;
}) {
  const name = attachmentName(attachment);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Chiudi anteprima"
      />
      <div className="relative z-10 max-h-[92vh] w-full max-w-[1040px] overflow-hidden rounded-[24px] bg-inverse-surface shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg"
          onClick={onClose}
          aria-label="Chiudi"
        >
          <span className="material-symbols-outlined" aria-hidden>
            close
          </span>
        </button>
        {attachment.file_type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.signed_url}
            alt={name}
            className="max-h-[92vh] w-full object-contain"
          />
        ) : (
          <video
            src={attachment.signed_url}
            controls
            autoPlay
            className="max-h-[92vh] w-full bg-black object-contain"
          />
        )}
      </div>
    </div>
  );
}

function QuoteTimelineCard({
  quote,
  role,
  context,
  onOpen,
}: {
  quote: QuoteRow;
  role: string | null;
  context: ConversationQuoteContext | null;
  onOpen: () => void;
}) {
  const professionalName = fullName(context?.professional ?? null);
  const clientName = fullName(context?.client ?? null);
  const mine = role === "professional";

  return (
    <div className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}>
      <button
        type="button"
        className={[
          "max-w-[78%] rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          mine
            ? "rounded-tr-none border-primary/20 bg-primary text-white"
            : "rounded-tl-none border-outline-variant/30 bg-surface-container-lowest text-on-surface",
        ].join(" ")}
        onClick={onOpen}
      >
        <div className="flex items-start gap-3">
          <span
            className={[
              "material-symbols-outlined mt-0.5",
              mine ? "text-white" : "text-[#FF8500]",
            ].join(" ")}
            aria-hidden
          >
            request_quote
          </span>
          <div className="min-w-0">
            <p className="font-label-md">
              {mine
                ? `Preventivo inviato a ${clientName}`
                : `Ecco il tuo preventivo da parte di ${professionalName}`}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={[
                  "rounded-full px-2 py-1 font-bold",
                  mine
                    ? "bg-white/15 text-white"
                    : "bg-surface-container-high text-on-surface-variant",
                ].join(" ")}
              >
                {quoteStatusLabel(quote.status)}
              </span>
              <span className={mine ? "text-white/80" : "text-on-surface-variant"}>
                Totale {money(quote.final_amount)}
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function QuoteSendModal({
  context,
  description,
  amount,
  discount,
  busy,
  error,
  onDescriptionChange,
  onAmountChange,
  onDiscountChange,
  onCancel,
  onSubmit,
}: {
  context: ConversationQuoteContext | null;
  description: string;
  amount: string;
  discount: number;
  busy: boolean;
  error: string | null;
  onDescriptionChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDiscountChange: (value: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const amountNumber = Number(amount);
  const safeAmount = Number.isFinite(amountNumber) && amountNumber > 0 ? amountNumber : 0;
  const finalAmount = Math.round(safeAmount * (1 - discount / 100) * 100) / 100;
  const discountValue = Math.round((safeAmount - finalAmount) * 100) / 100;
  const professional = context?.professional ?? null;
  const client = context?.client ?? null;
  const professionalTitle = professional?.headline || "Professione non indicata";
  const clientLocation = client?.province_name || client?.province_code || "Provincia non indicata";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/55 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Chiudi modale preventivo"
      />
      <div className="relative max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-[28px] border border-white/30 bg-surface-container-lowest p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low"
          onClick={onCancel}
          aria-label="Chiudi"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="pr-10 font-headline-sm text-[28px] text-primary">Invia preventivo</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-surface-container-low p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Dati professionista
            </p>
            <div className="flex items-center gap-3">
              {professional?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={professional.avatar_url}
                  alt={fullName(professional)}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed font-bold text-primary">
                  {initials(professional)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-label-md text-primary">{fullName(professional)}</p>
                <p className="truncate text-sm text-on-surface-variant">
                  {professionalTitle}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm text-on-surface-variant">
              <p>{professional?.phone || "Telefono non indicato"}</p>
              <p>{professional?.email || "Email non indicata"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-surface-container-low p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Dati cliente
            </p>
            <div className="flex items-center gap-3">
              {client?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.avatar_url}
                  alt={fullName(client)}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-fixed font-bold text-primary">
                  {initials(client)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-label-md text-primary">{fullName(client)}</p>
                <p className="truncate text-sm text-on-surface-variant">{clientLocation}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm text-on-surface-variant">
              <p>{client?.phone || "Telefono non indicato"}</p>
              <p>{client?.email || "Email non indicata"}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-primary">Descrizione preventivo</span>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              className="min-h-32 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Descrivi intervento, materiali e condizioni del preventivo…"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-primary">Prezzo</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="0,00"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-primary">Scontistica</span>
              <select
                value={discount}
                onChange={(event) => onDiscountChange(Number(event.target.value))}
                className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value={0}>Nessuno</option>
                {[10, 20, 30, 40, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 rounded-2xl bg-surface-container-low p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-on-surface-variant">Prezzo originale</p>
              <p className="font-bold text-primary">{money(safeAmount)}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Sconto</p>
              <p className="font-bold text-primary">{money(discountValue)}</p>
            </div>
            <div>
              <p className="text-on-surface-variant">Prezzo finale</p>
              <p className="font-bold text-[#FF8500]">{money(finalAmount)}</p>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full px-5 py-3 font-button text-primary transition hover:bg-primary-fixed disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            Annulla
          </button>
          <button
            type="button"
            className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-[#FF8500]/20 transition hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={busy}
            onClick={onSubmit}
          >
            {busy ? "Invio…" : "Invia preventivo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuoteDetailModal({
  quote,
  context,
  role,
  busy,
  error,
  onClose,
  onDecision,
}: {
  quote: QuoteRow;
  context: ConversationQuoteContext | null;
  role: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onDecision: (status: "accepted" | "rejected") => void;
}) {
  const professional = context?.professional ?? null;
  const canDecide = role === "customer" && quote.status === "pending";
  const professionalTitle = professional?.headline || "Professione non indicata";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Chiudi dettaglio preventivo"
      />
      <div className="relative w-full max-w-[620px] rounded-[28px] border border-white/30 bg-surface-container-lowest p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low"
          onClick={onClose}
          aria-label="Chiudi"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex items-center gap-3 pr-10">
          {professional?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={professional.avatar_url}
              alt={fullName(professional)}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed font-bold text-primary">
              {initials(professional)}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-headline-sm text-[26px] text-primary">{fullName(professional)}</h2>
            <p className="text-on-surface-variant">{professionalTitle}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-surface-container-low p-4">
          <p className="whitespace-pre-wrap text-on-surface">{quote.description}</p>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <p className="text-on-surface-variant">Prezzo</p>
            <p className="font-bold text-primary">{money(quote.amount)}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <p className="text-on-surface-variant">Sconto</p>
            <p className="font-bold text-primary">{quote.discount_percentage}%</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/30 p-4">
            <p className="text-on-surface-variant">Totale finale</p>
            <p className="font-bold text-[#FF8500]">{money(quote.final_amount)}</p>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface-variant">
          Stato: {quoteStatusLabel(quote.status)}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        {canDecide ? (
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-full bg-error px-6 py-3 font-button text-white transition hover:opacity-90 disabled:opacity-60"
              disabled={busy}
              onClick={() => onDecision("rejected")}
            >
              Rifiuta
            </button>
            <button
              type="button"
              className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-[#FF8500]/20 transition hover:bg-[#FF9A2B] disabled:opacity-60"
              disabled={busy}
              onClick={() => onDecision("accepted")}
            >
              Accetta
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewModal({
  rating,
  title,
  body,
  files,
  busy,
  error,
  onRatingChange,
  onTitleChange,
  onBodyChange,
  onFilesChange,
  onRemoveFile,
  onCancel,
  onSubmit,
}: {
  rating: number;
  title: string;
  body: string;
  files: File[];
  busy: boolean;
  error: string | null;
  onRatingChange: (value: number) => void;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onFilesChange: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/55 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Chiudi modale recensione"
      />
      <div className="relative max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-[28px] border border-white/30 bg-surface-container-lowest p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low"
          onClick={onCancel}
          aria-label="Chiudi"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="pr-10 font-headline-sm text-[28px] text-primary">Lascia una recensione</h2>

        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-sm font-bold text-primary">Valutazione</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={[
                    "material-symbols-outlined text-[32px] transition",
                    star <= rating ? "text-[#FF8500]" : "text-outline",
                  ].join(" ")}
                  onClick={() => onRatingChange(star)}
                  aria-label={`${star} stelle`}
                >
                  star
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-primary">
              Titolo recensione <span className="font-normal text-on-surface-variant">(opzionale)</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Es. Intervento preciso e puntuale"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-primary">
              Testo recensione <span className="font-normal text-on-surface-variant">(opzionale)</span>
            </span>
            <textarea
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Racconta la tua esperienza reale con il professionista…"
            />
          </label>

          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-primary transition hover:bg-surface-container-low">
              <span className="material-symbols-outlined" aria-hidden>
                add_photo_alternate
              </span>
              Aggiungi foto/video
              <input
                type="file"
                className="sr-only"
                multiple
                accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                onChange={(event) => {
                  onFilesChange(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {files.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {files.map((file, index) => (
                <PendingFilePreview
                  key={`${file.name}-${file.lastModified}-${index}`}
                  file={file}
                  onRemove={() => onRemoveFile(index)}
                />
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full px-5 py-3 font-button text-primary transition hover:bg-primary-fixed disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            Annulla
          </button>
          <button
            type="button"
            className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-[#FF8500]/20 transition hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={busy}
            onClick={onSubmit}
          >
            {busy ? "Invio…" : "Invia recensione"}
          </button>
        </div>
      </div>
    </div>
  );
}

function sortConversations(rows: ConversationRow[]) {
  return [...rows].sort((a, b) => {
    const aTs = a.last_message_at ?? a.created_at;
    const bTs = b.last_message_at ?? b.created_at;
    return bTs.localeCompare(aTs);
  });
}

export default function MessagesClient({
  initialMe,
  initialMeError,
  initialConversations,
  initialConversationsError,
  initialActiveConversationId,
  embedded = false,
}: MessagesClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const { isUserOnline, presenceReady } = useAuthenticatedPresence();

  const me = initialMe;
  const meError = initialMeError ?? null;
  const meId = me?.user.id ?? null;
  const role = me?.profile.role ?? null;

  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list");

  const [conversations, setConversations] = useState<ConversationRow[]>(
    () => sortConversations(initialConversations),
  );
  const [conversationsError, setConversationsError] = useState<string | null>(
    initialConversationsError ?? null,
  );
  const [search, setSearch] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetailResponse | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [blockedChatNotice, setBlockedChatNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [mediaViewer, setMediaViewer] = useState<ViewableAttachment | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [quoteContext, setQuoteContext] = useState<ConversationQuoteContext | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteDescription, setQuoteDescription] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteDiscount, setQuoteDiscount] = useState(0);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [activeQuote, setActiveQuote] = useState<QuoteRow | null>(null);
  const [quoteDecisionBusy, setQuoteDecisionBusy] = useState(false);
  const [quoteDecisionError, setQuoteDecisionError] = useState<string | null>(null);

  const [reviewedRequestIds, setReviewedRequestIds] = useState<Set<string>>(() => new Set());
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [remoteTyping, setRemoteTyping] = useState(false);

  const typingStopTimer = useRef<number | null>(null);
  const activePresenceTimer = useRef<number | null>(null);
  const hasBroadcastTypingOn = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const convChannelRef = useRef<RealtimeChannel | null>(null);
  const convChannelConversationIdRef = useRef<string | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelConversationIdRef = useRef<string | null>(null);
  const convListChannelRef = useRef<RealtimeChannel | null>(null);
  const messageReloadTimersRef = useRef<Map<string, number>>(new Map());
  const loadMessagesRequestRef = useRef(0);
  const markReadInFlightRef = useRef<Set<string>>(new Set());
  const activeIdRef = useRef<string | null>(activeId);
  const messagesRef = useRef<MessageRow[]>(messages);
  const conversationsRef = useRef<ConversationRow[]>(conversations);

  const filteredConversations = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = fullName(c.participant).toLowerCase();
    const last = (c.last_message_body ?? "").toLowerCase();
    const subject = (c.request_subject ?? "").toLowerCase();
    return name.includes(q) || last.includes(q) || subject.includes(q);
  });

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function applyConversationPatch(patch: Partial<ConversationRow> & { id: string }) {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === patch.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return sortConversations(next);
    });
  }

  function setMessagesSynced(updater: MessageRow[] | ((current: MessageRow[]) => MessageRow[])) {
    setMessages((current) => {
      const next =
        typeof updater === "function"
          ? (updater as (current: MessageRow[]) => MessageRow[])(current)
          : updater;
      const sorted = sortMessagesByDate(next);
      messagesRef.current = sorted;
      return sorted;
    });
  }

  function scheduleMessagesReload(conversationId: string, delayMs = 150) {
    const current = messageReloadTimersRef.current.get(conversationId);
    if (current) {
      window.clearTimeout(current);
    }

    const timer = window.setTimeout(() => {
      messageReloadTimersRef.current.delete(conversationId);
      if (activeIdRef.current !== conversationId) return;
      void loadMessages(conversationId, { background: true }).catch((error) => {
        console.error("[messages] Failed to reload messages", {
          error,
          conversationId,
          userId: meId,
        });
      });
    }, delayMs);

    messageReloadTimersRef.current.set(conversationId, timer);
  }

  function clearConversationRealtime() {
    const activePresenceConversationId = presenceChannelConversationIdRef.current;
    if (activePresenceConversationId) {
      void clearActiveConversationPresence(activePresenceConversationId);
    }
    stopTypingTimers();
    if (convChannelRef.current) {
      supabase.removeChannel(convChannelRef.current);
      convChannelRef.current = null;
      convChannelConversationIdRef.current = null;
    }
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
      presenceChannelConversationIdRef.current = null;
    }
    if (activePresenceTimer.current) {
      window.clearInterval(activePresenceTimer.current);
      activePresenceTimer.current = null;
    }
    setRemoteTyping(false);
  }

  async function hydrateConversation(id: string) {
    if (!id) return;
    try {
      const detail = await fetchJson<ConversationDetailResponse>(`/api/conversations/${id}`, {
        method: "GET",
      });
      const hydratedConversation: ConversationRow = {
        ...detail.conversation,
        participant: detail.participant ?? null,
        request_subject: detail.request?.subject ?? null,
      };
      setConversations((prev) => {
        if (prev.some((c) => c.id === id)) return prev;
        const next = sortConversations([...prev, hydratedConversation]);
        conversationsRef.current = next;
        return next;
      });
      setConversationsError(null);
    } catch (e) {
      setConversationsError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  async function loadMessages(
    id: string,
    options: { background?: boolean } = {},
  ): Promise<MessageRow[]> {
    if (!id || !UUID_PATTERN.test(id)) {
      console.error("[messages] Failed to load messages", {
        error: "Invalid conversation id",
        conversationId: id,
        userId: meId,
      });
      if (!options.background) {
        setMessagesError("Conversazione non valida.");
      }
      return [];
    }

    const requestId = ++loadMessagesRequestRef.current;
    const url = `/api/conversations/${id}/messages?limit=200`;
    const response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as
      | MessagesResponse
      | { error?: string }
      | null;

    if (!response.ok) {
      console.error("[messages] Failed to load messages", {
        url,
        status: response.status,
        body: payload,
        conversationId: id,
        userId: meId,
      });
      if (options.background) {
        return messagesRef.current;
      }
      const message =
        (payload as { error?: string } | null)?.error ?? `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }

    const data = payload as MessagesResponse;
    const nextMessages = sortMessagesByDate(data.messages ?? []);
    if (activeIdRef.current && activeIdRef.current !== id) {
      return nextMessages;
    }
    if (requestId !== loadMessagesRequestRef.current && activeIdRef.current === id) {
      return nextMessages;
    }
    setMessagesSynced(nextMessages);
    queueMicrotask(scrollToBottom);
    setMessagesError(null);
    return nextMessages;
  }

  async function loadQuotes(id: string) {
    try {
      const data = await fetchJson<ConversationQuotesResponse>(
        `/api/conversations/${id}/quotes`,
        { method: "GET" },
      );
      setQuotes(data.quotes ?? []);
      setQuoteContext(data.context ?? null);
    } catch (error) {
      console.error("[messages] Failed to load quotes", error);
      setQuotes([]);
      setQuoteContext(null);
    }
  }

  async function loadMyReviews() {
    if (role !== "customer") return;
    try {
      const data = await fetchJson<ReviewsMineResponse>("/api/reviews?mine=true&page_size=50", {
        method: "GET",
      });
      setReviewedRequestIds(new Set((data.reviews ?? []).map((review) => review.request_id)));
    } catch {
      // Review availability should never block the chat UI.
    }
  }

  async function sendQuote() {
    if (!activeId) return;

    setQuoteError(null);
    setQuoteSubmitting(true);
    try {
      const data = await fetchJson<{ quote: QuoteRow; context: ConversationQuoteContext | null }>(
        `/api/conversations/${activeId}/quotes`,
        {
          method: "POST",
          body: JSON.stringify({
            description: quoteDescription,
            amount: Number(quoteAmount),
            discount_percentage: quoteDiscount,
          }),
        },
      );

      setQuotes((current) =>
        current.some((quote) => quote.id === data.quote.id)
          ? current.map((quote) => (quote.id === data.quote.id ? data.quote : quote))
          : [...current, data.quote],
      );
      setQuoteContext(data.context ?? quoteContext);
      setQuoteDescription("");
      setQuoteAmount("");
      setQuoteDiscount(0);
      setQuoteModalOpen(false);
      queueMicrotask(scrollToBottom);
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function decideQuote(status: "accepted" | "rejected") {
    if (!activeQuote) return;
    setQuoteDecisionError(null);
    setQuoteDecisionBusy(true);
    try {
      const data = await fetchJson<{ quote: QuoteRow }>(`/api/quotes/${activeQuote.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setQuotes((current) =>
        current.map((quote) => (quote.id === data.quote.id ? data.quote : quote)),
      );
      setActiveQuote(data.quote);
    } catch (e) {
      setQuoteDecisionError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setQuoteDecisionBusy(false);
    }
  }

  async function submitReview() {
    const requestId = activeDetail?.request?.id ?? null;
    if (!requestId) return;

    setReviewError(null);
    setReviewSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("request_id", requestId);
      formData.append("rating", String(reviewRating));
      formData.append("title", reviewTitle);
      formData.append("body", reviewBody);
      reviewFiles.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/reviews", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Invio non riuscito (${response.status})`);
      }

      setReviewedRequestIds((current) => new Set(current).add(requestId));
      setReviewRating(5);
      setReviewTitle("");
      setReviewBody("");
      setReviewFiles([]);
      setReviewModalOpen(false);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function markConversationRead(id: string, candidateMessages?: MessageRow[]) {
    if (!meId || !id) return;
    const source =
      candidateMessages ??
      messagesRef.current.filter((message) => message.conversation_id === id);
    const hasUnreadIncoming = source.some(
      (message) =>
        !message.id.startsWith("local-") && message.sender_id !== meId && !message.read_at,
    );
    if (!hasUnreadIncoming || markReadInFlightRef.current.has(id)) return;

    markReadInFlightRef.current.add(id);
    try {
      await fetchJson<{ ok: true }>(`/api/conversations/${id}/read`, { method: "POST" });
      const readAt = new Date().toISOString();
      setMessagesSynced((current) =>
        current.map((message) =>
          message.conversation_id === id && message.sender_id !== meId && !message.read_at
            ? { ...message, read_at: readAt }
            : message,
        ),
      );
    } catch {
      // Read receipts are best-effort and should never block the chat UI.
    } finally {
      markReadInFlightRef.current.delete(id);
    }
  }

  async function touchActiveConversation(id: string) {
    try {
      await fetchJson<{ ok: true }>(`/api/conversations/${id}/presence`, { method: "POST" });
    } catch {
      // Active-chat presence is best-effort.
    }
  }

  async function clearActiveConversationPresence(id: string) {
    try {
      await fetchJson<{ ok: true }>(`/api/conversations/${id}/presence`, { method: "DELETE" });
    } catch {
      // Active-chat presence is best-effort.
    }
  }

  async function loadConversationDetail(id: string) {
    try {
      const detail = await fetchJson<ConversationDetailResponse>(`/api/conversations/${id}`, {
        method: "GET",
      });
      setActiveDetail(detail);
      setMessagesError(null);

      if (detail.request?.id) {
        try {
          const attachmentData = await fetchJson<AttachmentsResponse>(
            `/api/contact-requests/${detail.request.id}/attachments`,
            { method: "GET" },
          );
          setAttachments(attachmentData.attachments ?? []);
        } catch {
          setAttachments([]);
        }
      } else {
        setAttachments([]);
      }
    } catch (e) {
      setActiveDetail(null);
      setMessagesSynced([]);
      setAttachments([]);
      setMessagesError(e instanceof Error ? e.message : "Errore imprevisto.");
      return;
    }

    try {
      const loadedMessages = await loadMessages(id);
      void loadQuotes(id);
      void markConversationRead(id, loadedMessages);
    } catch (e) {
      setMessagesSynced([]);
      setMessagesError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  async function acceptOrReject(status: "accepted" | "rejected") {
    const reqId = (activeDetail?.request as ContactRequestSummary | null)?.id ?? null;
    if (!reqId) return;

    setMessagesError(null);
    try {
      const res = await fetchJson<{ request: { id: string; status: RequestStatus } }>(
        `/api/contact-requests/${reqId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      setActiveDetail((prev) =>
        prev?.request
          ? {
              ...prev,
              request: { ...prev.request, status: res.request.status },
            }
          : prev,
      );

      if (activeId) {
        applyConversationPatch({ id: activeId, status: res.request.status });
      }
    } catch (e) {
      setMessagesError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!activeId || (!body && pendingFiles.length === 0)) return;
    if (!chatEnabled) return;

    const conversationId = activeId;
    const localId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `local-${crypto.randomUUID()}`
        : `local-${Date.now()}`;
    const localMessage: MessageRow = {
      id: localId,
      conversation_id: conversationId,
      sender_id: meId ?? "",
      body: body || null,
      created_at: new Date().toISOString(),
      read_at: null,
      attachments: [],
    };

    setSendError(null);
    setSending(true);
    setMessagesSynced((prev) => [...prev, localMessage]);
    queueMicrotask(scrollToBottom);

    try {
      const formData = new FormData();
      formData.append("body", body);
      pendingFiles.forEach((file) => formData.append("files", file));

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: MessageRow;
        error?: string;
      };
      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? `Invio non riuscito (${response.status})`);
      }
      const res = { message: payload.message };

      setDraft("");
      setPendingFiles([]);
      hasBroadcastTypingOn.current = false;

      setMessagesSynced((prev) => {
        const withoutLocal = prev.filter((message) => message.id !== localId);
        if (withoutLocal.some((message) => message.id === res.message.id)) {
          return withoutLocal.map((message) =>
            message.id === res.message.id ? res.message : message,
          );
        }
        return [...withoutLocal, res.message];
      });

      applyConversationPatch({
        id: conversationId,
        last_message_at: res.message.created_at,
        last_message_body: res.message.body ?? (res.message.attachments?.length ? "Allegato" : null),
        last_message_sender_id: res.message.sender_id,
      });

      queueMicrotask(scrollToBottom);
    } catch (e) {
      setMessagesSynced((prev) => prev.filter((message) => message.id !== localId));
      setSendError(e instanceof Error ? e.message : "Errore imprevisto.");
    } finally {
      setSending(false);
    }
  }

  async function deleteChat() {
    if (!activeId) return;
    setDeleteError(null);

    try {
      await fetchJson<{ ok: true }>(`/api/conversations/${activeId}`, { method: "DELETE" });

      clearConversationRealtime();

      setConversations((prev) => prev.filter((c) => c.id !== activeId));
      setActiveId(null);
      activeIdRef.current = null;
      setActiveDetail(null);
      setMessagesSynced([]);
      setMobilePanel("list");
      setConfirmDeleteOpen(false);
      setMenuOpen(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Errore imprevisto.");
    }
  }

  function stopTypingTimers() {
    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
      typingStopTimer.current = null;
    }
    hasBroadcastTypingOn.current = false;
  }

  function sendTyping(isTyping: boolean) {
    const ch = presenceChannelRef.current;
    if (!ch || !meId || !activeId) return;

    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: meId, is_typing: isTyping } satisfies TypingPayload,
    });
  }

  function onDraftChange(next: string) {
    setDraft(next);

    if (!activeId || !meId) return;
    if (!presenceChannelRef.current) return;

    const shouldType = next.trim().length > 0;

    if (!shouldType) {
      stopTypingTimers();
      sendTyping(false);
      return;
    }

    if (!hasBroadcastTypingOn.current) {
      hasBroadcastTypingOn.current = true;
      sendTyping(true);
    }

    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
    }
    typingStopTimer.current = window.setTimeout(() => {
      hasBroadcastTypingOn.current = false;
      sendTyping(false);
    }, 1500);
  }

  function setupConversationSubscriptions(conversationId: string, otherUserId: string) {
    if (!meId) return;

    if (
      convChannelRef.current &&
      convChannelConversationIdRef.current !== conversationId
    ) {
      supabase.removeChannel(convChannelRef.current);
      convChannelRef.current = null;
      convChannelConversationIdRef.current = null;
    }
    if (activePresenceTimer.current) {
      window.clearInterval(activePresenceTimer.current);
      activePresenceTimer.current = null;
    }

    if (!convChannelRef.current) {
      const msgChannel = supabase
        .channel(`db:messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            const row = payload.new;
            if (!row || typeof row !== "object" || !("id" in row)) return;
            const message = row as MessageRow;
            setMessagesSynced((current) => mergeMessage(current, message));
            scheduleMessagesReload(conversationId, 250);
            if (message.sender_id !== meId) {
              void markConversationRead(conversationId, [message]);
            }
            applyConversationPatch({
              id: conversationId,
              last_message_at: message.created_at,
              last_message_body: message.body ?? "Allegato",
              last_message_sender_id: message.sender_id,
            });
            queueMicrotask(scrollToBottom);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "message_attachments",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            scheduleMessagesReload(conversationId, 150);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            const row = payload.new;
            if (!row || typeof row !== "object" || !("id" in row)) return;
            const message = row as MessageRow;
            setMessagesSynced((prev) =>
              prev.map((item) =>
                item.id === message.id
                  ? { ...item, ...message, attachments: item.attachments ?? [] }
                  : item,
              ),
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: RealtimePostgresChangesPayload<MessageRow>) => {
            const row = payload.old as Partial<MessageRow> | null;
            if (!row?.id) return;
            setMessagesSynced((prev) => prev.filter((message) => message.id !== row.id));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "quotes",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            void loadQuotes(conversationId);
          },
        )
        .subscribe();

      convChannelRef.current = msgChannel;
      convChannelConversationIdRef.current = conversationId;
    }

    if (
      presenceChannelRef.current &&
      presenceChannelConversationIdRef.current !== conversationId
    ) {
      const previousPresenceConversationId = presenceChannelConversationIdRef.current;
      if (previousPresenceConversationId) {
        void clearActiveConversationPresence(previousPresenceConversationId);
      }
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
      presenceChannelConversationIdRef.current = null;
    }
    if (activePresenceTimer.current) {
      window.clearInterval(activePresenceTimer.current);
      activePresenceTimer.current = null;
    }

    stopTypingTimers();
    setRemoteTyping(false);

    if (!presenceChannelRef.current) {
      const presenceChannel = supabase
        .channel(`conversation:${conversationId}`, {
          config: { private: true },
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const p = payload as TypingPayload | undefined;
          if (!p || p.user_id !== otherUserId) return;
          setRemoteTyping(Boolean(p.is_typing));
        })
        .subscribe();

      presenceChannelRef.current = presenceChannel;
      presenceChannelConversationIdRef.current = conversationId;
    }
    void touchActiveConversation(conversationId);
    activePresenceTimer.current = window.setInterval(() => {
      void touchActiveConversation(conversationId);
    }, 25000);
  }

  function selectConversation(id: string) {
    if (!meId) return;

    const conv = conversationsRef.current.find((c) => c.id === id) ?? null;
    if (isUnavailableCustomerConversation(role, conv)) {
      setMobilePanel("list");
      setActiveId(null);
      activeIdRef.current = null;
      setActiveDetail(null);
      setMessagesSynced([]);
      setQuotes([]);
      setQuoteContext(null);
      setAttachments([]);
      setPendingFiles([]);
      setMessagesError(null);
      setSendError(null);
      setBlockedChatNotice(
        "Chat non disponibile: il professionista non ha un abbonamento attivo.",
      );
      clearConversationRealtime();
      return;
    }

    setMobilePanel("chat");
    setActiveId(id);
    activeIdRef.current = id;
    setActiveDetail(null);
    setMessagesSynced([]);
    setQuotes([]);
    setQuoteContext(null);
    setAttachments([]);
    setPendingFiles([]);
    setMessagesError(null);
    setBlockedChatNotice(null);
    setSendError(null);
    setQuoteError(null);
    setQuoteModalOpen(false);
    setActiveQuote(null);
    setQuoteDecisionError(null);
    setReviewError(null);
    setReviewModalOpen(false);
    setReviewFiles([]);
    setDeleteError(null);
    setMenuOpen(false);
    setConfirmDeleteOpen(false);
    setRemoteTyping(false);
    stopTypingTimers();

    const otherUserId = conv
      ? conv.customer_id === meId
        ? conv.professional_id
        : conv.customer_id
      : null;

    if (otherUserId) {
      setupConversationSubscriptions(id, otherUserId);
    }

    void loadConversationDetail(id);
  }

  // Optional deep-link: /messages?conversation=<id>
  useEffect(() => {
    if (!initialActiveConversationId) return;
    if (!meId) return;
    if (activeId) return;

    // If the conversation is already in the list, open it. Otherwise try to hydrate it.
    const exists = conversationsRef.current.some((c) => c.id === initialActiveConversationId);
    if (exists) {
      selectConversation(initialActiveConversationId);
      return;
    }

    void hydrateConversation(initialActiveConversationId).then(() => {
      selectConversation(initialActiveConversationId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActiveConversationId, meId]);

  // Keep a stable reference for subscriptions & event handlers.
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!meId || role !== "customer") return;
    const timer = window.setTimeout(() => {
      void loadMyReviews();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, role]);

  // Realtime: keep conversation list fresh (status changes + last message preview + new conversations)
  useEffect(() => {
    if (!meId || !role || role === "admin") return;

    if (convListChannelRef.current) {
      supabase.removeChannel(convListChannelRef.current);
      convListChannelRef.current = null;
    }

    const filter =
      role === "customer"
        ? `customer_id=eq.${meId}`
        : `professional_id=eq.${meId}`;

    const channel = supabase
      .channel(`db:conversations:${meId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter },
        (payload: RealtimePostgresChangesPayload<ConversationRow>) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;
          const conversation = row as ConversationRow;
          applyConversationPatch({
            id: conversation.id,
            status: conversation.status,
            last_message_at: conversation.last_message_at,
            last_message_body: conversation.last_message_body,
            last_message_sender_id: conversation.last_message_sender_id,
            updated_at: conversation.updated_at,
          });

          if (activeId && conversation.id === activeId) {
            setActiveDetail((prev) =>
              prev
                ? {
                    ...prev,
                    conversation: { ...prev.conversation, ...conversation },
                  }
                : prev,
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter },
        (payload: RealtimePostgresChangesPayload<ConversationRow>) => {
          const row = payload.new;
          if (!row || typeof row !== "object" || !("id" in row)) return;
          const conversation = row as ConversationRow;
          void hydrateConversation(conversation.id);
        },
      )
      .subscribe();

    convListChannelRef.current = channel;

    return () => {
      if (convListChannelRef.current) {
        supabase.removeChannel(convListChannelRef.current);
        convListChannelRef.current = null;
      }
    };
  }, [meId, role, activeId, supabase]);

  // Cleanup active chat channels on unmount.
  useEffect(() => {
    const reloadTimers = messageReloadTimersRef.current;

    return () => {
      const activePresenceConversationId = presenceChannelConversationIdRef.current;
      if (activePresenceConversationId) {
        void clearActiveConversationPresence(activePresenceConversationId);
      }
      for (const timer of reloadTimers.values()) {
        window.clearTimeout(timer);
      }
      reloadTimers.clear();
      stopTypingTimers();
      if (convChannelRef.current) {
        supabase.removeChannel(convChannelRef.current);
        convChannelRef.current = null;
        convChannelConversationIdRef.current = null;
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
        presenceChannelConversationIdRef.current = null;
      }
      if (activePresenceTimer.current) {
        window.clearInterval(activePresenceTimer.current);
        activePresenceTimer.current = null;
      }
    };
  }, [supabase]);

  const activeConvListRow = activeId
    ? conversations.find((c) => c.id === activeId) ?? null
    : null;
  const currentRequestStatus =
    activeDetail?.request?.status ??
    activeDetail?.conversation.status ??
    activeConvListRow?.status ??
    null;
  const chatEnabled = currentRequestStatus === "accepted";
  const chatReadOnly = isReadOnlyStatus(currentRequestStatus);
  const participantId =
    activeDetail?.participant?.id ?? activeConvListRow?.participant?.id ?? null;
  const initialParticipantOnline =
    Boolean(activeDetail?.participant?.is_online) ||
    Boolean(activeConvListRow?.participant?.is_online);
  const participantOnline = participantId
    ? presenceReady
      ? isUserOnline(participantId)
      : initialParticipantOnline
    : false;
  const canSendMessage = chatEnabled && !sending && (Boolean(draft.trim()) || pendingFiles.length > 0);
  const currentRequestId = activeDetail?.request?.id ?? null;
  const reviewAlreadySent = currentRequestId ? reviewedRequestIds.has(currentRequestId) : false;
  const timeline = useMemo(
    () => {
      const request = activeDetail?.request ?? null;
      const requestItems =
        request && (request.message || attachments.length > 0)
          ? [
              {
                kind: "request" as const,
                at: request.created_at,
                request,
                attachments,
              },
            ]
          : [];

      return [
        ...requestItems,
        ...messages.map((message) => ({
          kind: "message" as const,
          at: message.created_at,
          message,
        })),
        ...quotes.map((quote) => ({
          kind: "quote" as const,
          at: quote.created_at,
          quote,
        })),
      ].sort((a, b) => a.at.localeCompare(b.at));
    },
    [activeDetail?.request, attachments, messages, quotes],
  );

  function addPendingFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPendingFiles((current) => [...current, ...Array.from(files)].slice(0, 10));
  }

  function addReviewFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setReviewFiles((current) => [...current, ...Array.from(files)].slice(0, 6));
  }

  const showListOnMobile = mobilePanel === "list";
  const showChatOnMobile = mobilePanel === "chat";

  return (
    <main
      className={[
        embedded ? "h-full min-h-0" : "h-[100dvh] min-h-0",
        "flex flex-col overflow-hidden bg-background md:flex-row",
      ].join(" ")}
    >
      <section
        className={[
          showListOnMobile ? "flex" : "hidden",
          "md:flex w-full md:max-w-[360px] md:border-r border-outline-variant bg-surface-container-lowest flex-col flex-1 md:flex-none shrink-0",
        ].join(" ")}
      >
        <div className="p-4 border-b border-outline-variant/30 bg-surface-container-lowest">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-headline-sm text-primary text-[18px] leading-tight">
                Messaggi
              </div>
              <div className="text-[12px] text-on-surface-variant">
                {me?.profile.role === "professional"
                  ? "Account Professionista"
                  : me?.profile.role === "customer"
                    ? "Account Cliente"
                    : ""}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <input
              className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-md transition-all"
              placeholder="Cerca conversazione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
          {meError ? (
            <div className="p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
              {meError}
            </div>
          ) : null}

          {conversationsError ? (
            <div className="p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
              {conversationsError}
            </div>
          ) : null}

          {!me && !meError ? (
            <div className="p-3 text-on-surface-variant">Caricamento…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-3 text-on-surface-variant">Nessuna conversazione.</div>
          ) : (
            filteredConversations.map((c) => {
              const selected = c.id === activeId;
              const unavailable = isUnavailableCustomerConversation(role, c);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    if (!unavailable) selectConversation(c.id);
                  }}
                  className={[
                    "w-full text-left p-3 rounded-2xl border transition-all",
                    unavailable
                      ? "cursor-not-allowed border-outline-variant/30 bg-surface-container-highest/60 opacity-80"
                      : selected
                      ? "bg-surface-container-high border-primary-container shadow-sm"
                      : "bg-surface-container-lowest border-outline-variant/30 hover:bg-surface-container",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-label-md text-primary truncate">
                        {fullName(c.participant)}
                      </div>
                      {role === "customer" && c.participant?.headline ? (
                        <div className="text-[12px] font-semibold text-primary/75 truncate">
                          {c.participant.headline}
                        </div>
                      ) : null}
                      <div
                        className={[
                          "text-[12px] truncate",
                          unavailable
                            ? "font-semibold text-on-error-container"
                            : "text-on-surface-variant",
                        ].join(" ")}
                      >
                        {unavailable
                          ? "Chat non disponibile: il professionista non ha un abbonamento attivo"
                          : c.last_message_body ?? c.request_subject ?? "Richiesta di contatto"}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-outline">
                      {formatTime(c.last_message_at ?? c.created_at)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                        statusBadgeClass(c.status),
                      ].join(" ")}
                    >
                      {statusLabel(c.status)}
                    </span>
                    {unavailable ? (
                      <span className="inline-flex items-center rounded-full bg-error-container px-2 py-0.5 text-[10px] font-bold text-on-error-container">
                        Non disponibile
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section
        className={[
          showChatOnMobile ? "flex" : "hidden",
          "md:flex flex-1 flex-col bg-surface-bright min-h-0",
        ].join(" ")}
      >
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-[448px] text-center">
              {blockedChatNotice ? (
                <div className="mb-4 rounded-2xl border border-error/20 bg-error-container p-4 text-sm font-semibold text-on-error-container">
                  {blockedChatNotice}
                </div>
              ) : null}
              <div className="text-headline-sm text-primary mb-2">
                Seleziona una conversazione
              </div>
              <p className="text-on-surface-variant">
                Scegli una chat dalla lista a sinistra per iniziare.
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2">
                  <button
                    type="button"
                    className="md:hidden mt-0.5 px-3 py-2 rounded-full border border-outline-variant/40 hover:bg-surface-container-low transition-colors text-primary"
                    onClick={() => setMobilePanel("list")}
                    title="Indietro"
                  >
                    ←
                  </button>
                  <div className="min-w-0">
                    <div className="font-headline-sm text-primary leading-tight truncate">
                      {fullName(activeDetail?.participant ?? activeConvListRow?.participant)}
                    </div>
                    <div className="text-[12px] text-on-surface-variant flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1",
                          participantOnline ? "text-emerald-600" : "text-outline",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "w-2 h-2 rounded-full",
                            participantOnline ? "bg-emerald-500" : "bg-outline-variant",
                          ].join(" ")}
                        />
                        {remoteTyping
                          ? "Sta scrivendo…"
                          : participantOnline
                            ? "Online ora"
                            : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {role === "professional" && chatEnabled ? (
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/40 text-primary transition-colors hover:bg-surface-container-low"
                      onClick={() => setQuoteModalOpen(true)}
                      title="Invia preventivo"
                      aria-label="Invia preventivo"
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        request_quote
                      </span>
                    </button>
                  ) : null}

                  {role === "customer" ? (
                    <button
                      type="button"
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                        chatEnabled && !reviewAlreadySent
                          ? "border-[#FF8500]/40 text-[#FF8500] hover:bg-[#FF8500]/10"
                          : "cursor-not-allowed border-outline-variant/40 text-outline",
                      ].join(" ")}
                      disabled={!chatEnabled || reviewAlreadySent}
                      onClick={() => {
                        setReviewError(null);
                        setReviewModalOpen(true);
                      }}
                      title={
                        reviewAlreadySent
                          ? "Recensione già inviata"
                          : chatEnabled
                            ? "Lascia una recensione"
                            : "Recensione disponibile dopo accettazione"
                      }
                      aria-label="Lascia una recensione"
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        star
                      </span>
                    </button>
                  ) : null}

                  <div className="relative">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-full border border-outline-variant/40 hover:bg-surface-container-low transition-colors text-primary"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      ⋯
                    </button>

                    {menuOpen ? (
                      <div
                        className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-[0_4px_20px_rgba(8,43,95,0.08)] overflow-hidden z-20"
                        role="menu"
                      >
                        <button
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors text-error font-label-md text-[13px]"
                          onClick={() => {
                            setConfirmDeleteOpen(true);
                            setMenuOpen(false);
                          }}
                        >
                          Cancella chat
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {activeDetail?.request ? (
                <div className="px-4 pb-4">
                  <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold">
                        Stato richiesta
                      </div>
                      <div className="text-primary font-label-md truncate">
                        {activeDetail.request.subject}
                      </div>
                      <div className="text-[12px] text-on-surface-variant">
                        {statusLabel(activeDetail.request.status)} •{" "}
                        {formatDay(activeDetail.request.created_at)}
                      </div>
                    </div>

                    {role === "professional" && activeDetail.request.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full bg-error text-white font-button text-[14px] hover:opacity-90 transition-colors"
                          onClick={() => acceptOrReject("rejected")}
                        >
                          Rifiuta
                        </button>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-full bg-[#FF8500] text-white font-button text-[14px] hover:bg-[#FF9A2B] transition-colors shadow-sm"
                          onClick={() => acceptOrReject("accepted")}
                        >
                          Accetta richiesta
                        </button>
                      </div>
                    ) : (
                      <span
                        className={[
                          "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold",
                          statusBadgeClass(activeDetail.request.status),
                        ].join(" ")}
                      >
                        {statusLabel(activeDetail.request.status)}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4">
              {messagesError ? (
                <div className="p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
                  {messagesError}
                </div>
              ) : null}

              {!chatEnabled && activeDetail?.request ? (
                <div className="mx-auto max-w-[640px] rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-sm text-on-surface-variant shadow-sm">
                  {activeDetail.request.status === "pending"
                    ? "La richiesta è in attesa: accettala per abilitare la chat."
                    : chatReadOnly
                      ? "Questa richiesta non è più modificabile: la chat è in sola lettura."
                      : "La chat sarà disponibile quando la richiesta verrà accettata."}
                </div>
              ) : null}

              {timeline.map((item) => {
                if (item.kind === "request") {
                  const mine = role === "customer";
                  return (
                    <div
                      key={`request-${item.request.id}`}
                      className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}
                    >
                      <div className="max-w-[70%]">
                        <div
                          className={[
                            "px-4 py-3 rounded-2xl shadow-sm border",
                            mine
                              ? "bg-primary text-white border-primary/20 rounded-tr-none"
                              : "bg-surface-container-lowest border-outline-variant/30 rounded-tl-none",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "mb-2 text-[11px] font-bold uppercase tracking-widest",
                              mine ? "text-white/70" : "text-on-surface-variant",
                            ].join(" ")}
                          >
                            Richiesta iniziale
                          </div>
                          <p className="text-body-md leading-relaxed whitespace-pre-wrap break-words">
                            {item.request.message || item.request.subject}
                          </p>
                          {item.attachments.map((attachment) => (
                            <AttachmentPreview
                              key={attachment.path}
                              attachment={attachment}
                              mine={mine}
                              onOpen={(attachmentItem) => setMediaViewer(attachmentItem)}
                            />
                          ))}
                        </div>
                        <div
                          className={[
                            "mt-1 text-[10px] text-outline",
                            mine ? "text-right" : "text-left",
                          ].join(" ")}
                        >
                          {formatTime(item.request.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (item.kind === "quote") {
                  return (
                    <QuoteTimelineCard
                      key={`quote-${item.quote.id}`}
                      quote={item.quote}
                      role={role}
                      context={quoteContext}
                      onOpen={() => {
                        setQuoteDecisionError(null);
                        setActiveQuote(item.quote);
                      }}
                    />
                  );
                }

                const m = item.message;
                const mine = meId ? m.sender_id === meId : false;
                const pending = m.id.startsWith("local-");
                return (
                  <div
                    key={`message-${m.id}`}
                    className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}
                  >
                    <div className="max-w-[70%]">
                      <div
                        className={[
                          "px-4 py-3 rounded-2xl shadow-sm border",
                          mine
                            ? "bg-primary text-white border-primary/20 rounded-tr-none"
                            : "bg-surface-container-lowest border-outline-variant/30 rounded-tl-none",
                        ].join(" ")}
                      >
                        {m.body ? (
                          <p className="text-body-md leading-relaxed whitespace-pre-wrap break-words">
                            {m.body}
                          </p>
                        ) : null}
                        {m.attachments?.map((attachment) => (
                          <AttachmentPreview
                            key={attachment.id}
                            attachment={attachment}
                            mine={mine}
                            onOpen={(attachmentItem) => setMediaViewer(attachmentItem)}
                          />
                        ))}
                      </div>
                      <div
                        className={[
                          "mt-1 text-[10px] text-outline",
                          mine ? "text-right" : "text-left",
                        ].join(" ")}
                      >
                        {pending ? "Invio…" : formatTime(m.created_at)}
                      </div>
                      {mine && !pending && m.read_at ? (
                        <div className="mt-0.5 text-right text-[10px] font-bold text-primary">
                          Messaggio visualizzato
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            <footer className="shrink-0 border-t border-outline-variant/30 bg-surface-container-lowest p-4">
              {sendError ? (
                <div className="mb-3 p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
                  {sendError}
                </div>
              ) : null}

              {pendingFiles.length > 0 ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                  {pendingFiles.map((file, index) => (
                    <PendingFilePreview
                      key={`${file.name}-${file.lastModified}-${index}`}
                      file={file}
                      onRemove={() =>
                        setPendingFiles((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    />
                  ))}
                </div>
              ) : null}

              <form
                className="flex items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <label
                  className={[
                    "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-outline-variant/40 text-primary transition-colors",
                    chatEnabled
                      ? "hover:bg-surface-container-low"
                      : "cursor-not-allowed opacity-50",
                  ].join(" ")}
                  title="Allega file"
                >
                  <span className="material-symbols-outlined">attach_file</span>
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    disabled={!chatEnabled || sending}
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                    onChange={(event) => {
                      addPendingFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
                <textarea
                  className="flex-1 px-4 py-3 bg-surface-container-low border border-outline-variant rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-body-md resize-none min-h-[48px] max-h-[140px] transition-all"
                  placeholder={
                    chatEnabled
                      ? "Scrivi un messaggio…"
                      : "Accetta la richiesta per abilitare la chat"
                  }
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  disabled={!chatEnabled}
                  rows={1}
                />
                <button
                  type="submit"
                  disabled={!canSendMessage}
                  className={[
                    "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all",
                    !canSendMessage
                      ? "bg-outline-variant cursor-not-allowed"
                      : "bg-[#FF8500] hover:bg-[#FF9A2B] active:scale-[0.98]",
                  ].join(" ")}
                  title="Invia"
                >
                  ➤
                </button>
              </form>
            </footer>

            {confirmDeleteOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
                  onClick={() => setConfirmDeleteOpen(false)}
                />
                <div className="relative w-full max-w-[448px] bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_12px_40px_rgba(8,43,95,0.18)] p-6">
                  <div className="font-headline-sm text-primary mb-2">
                    Cancellare la chat?
                  </div>
                  <p className="text-on-surface-variant mb-4">
                    La conversazione verrà rimossa dalla tua lista. L’altra persona potrà
                    continuare a vederla.
                  </p>

                  {deleteError ? (
                    <div className="mb-4 p-3 text-sm text-on-error-container bg-error-container rounded-xl border border-error/20">
                      {deleteError}
                    </div>
                  ) : null}

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full border-2 border-primary text-primary font-button hover:bg-primary-fixed transition-colors"
                      onClick={() => setConfirmDeleteOpen(false)}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full bg-error text-white font-button hover:opacity-90 transition-colors"
                      onClick={() => void deleteChat()}
                    >
                      Cancella
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {mediaViewer ? (
              <MediaViewer attachment={mediaViewer} onClose={() => setMediaViewer(null)} />
            ) : null}

            {quoteModalOpen ? (
              <QuoteSendModal
                context={quoteContext}
                description={quoteDescription}
                amount={quoteAmount}
                discount={quoteDiscount}
                busy={quoteSubmitting}
                error={quoteError}
                onDescriptionChange={setQuoteDescription}
                onAmountChange={setQuoteAmount}
                onDiscountChange={setQuoteDiscount}
                onCancel={() => {
                  setQuoteModalOpen(false);
                  setQuoteError(null);
                }}
                onSubmit={() => void sendQuote()}
              />
            ) : null}

            {activeQuote ? (
              <QuoteDetailModal
                quote={activeQuote}
                context={quoteContext}
                role={role}
                busy={quoteDecisionBusy}
                error={quoteDecisionError}
                onClose={() => {
                  setActiveQuote(null);
                  setQuoteDecisionError(null);
                }}
                onDecision={(status) => void decideQuote(status)}
              />
            ) : null}

            {reviewModalOpen ? (
              <ReviewModal
                rating={reviewRating}
                title={reviewTitle}
                body={reviewBody}
                files={reviewFiles}
                busy={reviewSubmitting}
                error={reviewError}
                onRatingChange={setReviewRating}
                onTitleChange={setReviewTitle}
                onBodyChange={setReviewBody}
                onFilesChange={addReviewFiles}
                onRemoveFile={(index) =>
                  setReviewFiles((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                onCancel={() => {
                  setReviewModalOpen(false);
                  setReviewError(null);
                }}
                onSubmit={() => void submitReview()}
              />
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

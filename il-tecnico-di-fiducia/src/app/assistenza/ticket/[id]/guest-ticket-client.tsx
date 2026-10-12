"use client";

import { useCallback, useEffect, useState } from "react";

type GuestTicket = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  subject: string;
  body: string;
  status: "open" | "waiting" | "closed";
  created_at: string;
  updated_at: string;
};

type GuestAttachment = {
  id: string;
  file_type: "image" | "video";
  mime_type: string;
  file_name: string;
  file_size: number;
  signed_url: string;
  expires_at: string;
  created_at: string;
};

type GuestMessage = {
  id: string;
  sender_role: "customer" | "professional" | "admin" | "guest";
  body: string;
  created_at: string;
  attachments?: GuestAttachment[];
};

type PendingAttachment = {
  file: File;
  preview_url: string;
};

type TicketResponse = {
  ticket: GuestTicket;
  messages: GuestMessage[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: GuestTicket["status"]) {
  if (status === "closed") return "Risolto";
  if (status === "waiting") return "In attesa";
  return "Aperto";
}

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GuestTicketClient({
  ticketId,
  token,
}: {
  ticketId: string;
  token: string;
}) {
  const [data, setData] = useState<TicketResponse | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/public/support-tickets/${encodeURIComponent(
          ticketId,
        )}?token=${encodeURIComponent(token)}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        throw new Error(
          response.status === 404
            ? "Il link del ticket non è valido."
            : payload?.error ?? "Non è stato possibile caricare il ticket.",
        );
      }

      const payload = (await response.json()) as TicketResponse;
      setData(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Non è stato possibile caricare il ticket.",
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId, token]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadTicket();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [loadTicket]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);

    const incoming = Array.from(files);

    if (pendingAttachments.length + incoming.length > MAX_FILES) {
      setError(`Puoi allegare al massimo ${MAX_FILES} file.`);
      return;
    }

    for (const fileItem of incoming) {
      if (!ALLOWED_FILE_TYPES.has(fileItem.type)) {
        setError(
          "Formato non supportato. Puoi allegare JPG, PNG, WebP, MP4 o MOV.",
        );
        return;
      }

      if (fileItem.size <= 0) {
        setError("Uno degli allegati selezionati è vuoto.");
        return;
      }

      if (fileItem.size > MAX_FILE_SIZE_BYTES) {
        setError("Ogni allegato può pesare al massimo 50 MB.");
        return;
      }
    }

    const next = incoming.map((fileItem) => ({
      file: fileItem,
      preview_url: URL.createObjectURL(fileItem),
    }));

    setPendingAttachments((current) => [...current, ...next]);
  }

  function removePendingAttachment(index: number) {
    setPendingAttachments((current) => {
      const target = current[index];

      if (target) {
        URL.revokeObjectURL(target.preview_url);
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function uploadFileToSignedUrl({
    signedUrl,
    file,
    onProgress,
  }: {
    signedUrl: string;
    file: File;
    onProgress: (percentage: number) => void;
  }) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let settled = false;

      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      xhr.open("PUT", signedUrl);
      xhr.timeout = 10 * 60 * 1000;
      xhr.setRequestHeader("x-upsert", "false");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) return;

        const percentage = Math.min(
          100,
          Math.max(
            0,
            Math.round((event.loaded / event.total) * 100),
          ),
        );

        onProgress(percentage);
      };

      xhr.upload.onload = () => {
        onProgress(100);
        resolveOnce();
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolveOnce();
          return;
        }

        rejectOnce(
          new Error(
            `Caricamento allegato non riuscito (HTTP ${xhr.status}).`,
          ),
        );
      };

      xhr.onerror = () => {
        rejectOnce(
          new Error(
            "Connessione interrotta durante il caricamento dell'allegato.",
          ),
        );
      };

      xhr.ontimeout = () => {
        rejectOnce(
          new Error(
            "Il caricamento dell'allegato ha impiegato troppo tempo.",
          ),
        );
      };

      xhr.onabort = () => {
        rejectOnce(new Error("Caricamento allegato interrotto."));
      };

      const formData = new FormData();
      formData.append("cacheControl", "3600");
      formData.append("", file);

      xhr.send(formData);
    });
  }

  async function sendReply() {
    const cleanReply = reply.trim();

    if (!cleanReply || sending || data?.ticket.status !== "waiting") {
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(
      pendingAttachments.length > 0 ? 0 : null,
    );
    setUploadStage(
      pendingAttachments.length > 0
        ? "Preparazione allegato…"
        : "Invio risposta…",
    );

    try {
      const uploadedAttachments: Array<{
        bucket: string;
        path: string;
        file_name: string;
        file_size: number;
        mime_type: string;
      }> = [];

      for (const { file } of pendingAttachments) {
        const prepareResponse = await fetch(
          `/api/public/support-tickets/${encodeURIComponent(
            ticketId,
          )}/attachments/upload?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type,
            }),
          },
        );

        const prepared = (await prepareResponse
          .json()
          .catch(() => null)) as
          | {
              error?: string;
              bucket?: string;
              path?: string;
              signed_url?: string;
              upload_token?: string;
              file_name?: string;
              file_size?: number;
              mime_type?: string;
            }
          | null;

        if (
          !prepareResponse.ok ||
          !prepared?.bucket ||
          !prepared.path ||
          !prepared.signed_url ||
          !prepared.upload_token ||
          !prepared.file_name ||
          typeof prepared.file_size !== "number" ||
          !prepared.mime_type
        ) {
          throw new Error(
            prepared?.error ??
              "Non è stato possibile preparare il caricamento dell'allegato.",
          );
        }

        setUploadStage(
          `Caricamento ${prepared.file_name}…`,
        );

        await uploadFileToSignedUrl({
          signedUrl: prepared.signed_url,
          file,
          onProgress: (percentage) => {
            setUploadProgress(percentage);
          },
        });

        setUploadProgress(100);
        setUploadStage("Verifica allegato…");

        uploadedAttachments.push({
          bucket: prepared.bucket,
          path: prepared.path,
          file_name: prepared.file_name,
          file_size: prepared.file_size,
          mime_type: prepared.mime_type,
        });
      }

      setUploadStage(
        uploadedAttachments.length > 0
          ? "Verifica allegato…"
          : "Invio risposta…",
      );

      const finalizationController = new AbortController();
      const finalizationTimeout = window.setTimeout(() => {
        finalizationController.abort();
      }, 45_000);

      let response: Response;

      try {
        response = await fetch(
          `/api/public/support-tickets/${encodeURIComponent(
            ticketId,
          )}?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              body: cleanReply,
              attachments: uploadedAttachments,
            }),
            signal: finalizationController.signal,
          },
        );
      } catch (finalizationError) {
        if (
          finalizationError instanceof DOMException &&
          finalizationError.name === "AbortError"
        ) {
          throw new Error(
            "Il video è stato caricato, ma la verifica dell'allegato sta impiegando troppo tempo.",
          );
        }

        throw finalizationError;
      } finally {
        window.clearTimeout(finalizationTimeout);
      }

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Non è stato possibile inviare la risposta.",
        );
      }

      setReply("");

      pendingAttachments.forEach((attachment) => {
        URL.revokeObjectURL(attachment.preview_url);
      });

      setPendingAttachments([]);
      setUploadProgress(100);
      setUploadStage("Completato");
      setSuccess("Risposta inviata correttamente.");
      await loadTicket();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Non è stato possibile inviare la risposta.",
      );
    } finally {
      setSending(false);
      setUploadProgress(null);
      setUploadStage(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-5 py-12">
        <div className="flex items-center gap-3 text-primary">
          <span
            className="material-symbols-outlined animate-spin"
            aria-hidden
          >
            progress_activity
          </span>
          Caricamento…
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="rounded-[28px] border border-outline-variant/30 bg-white p-8 text-center shadow-sm">
          <h1 className="font-headline-sm text-3xl text-primary">
            Ticket non disponibile
          </h1>
          <p className="mt-4 text-on-surface-variant">
            {error ?? "Il link utilizzato non è valido."}
          </p>
          <a
            href="/contattaci"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#FF8500] px-6 font-button text-white"
          >
            Contattaci
          </a>
        </div>
      </main>
    );
  }

  const { ticket, messages } = data;
  const closed = ticket.status === "closed";
  const canReply = ticket.status === "waiting";
  const waitingForAdmin = ticket.status === "open";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="overflow-hidden rounded-[28px] border border-outline-variant/30 bg-white shadow-[0_18px_60px_rgba(8,43,95,0.10)]">
        <header className="border-b border-outline-variant/30 bg-surface-container-low p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-label-md text-sm uppercase tracking-[0.14em] text-[#FF8500]">
                Assistenza
              </p>
              <h1 className="mt-1 font-headline-sm text-2xl text-primary sm:text-3xl">
                {ticket.subject}
              </h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                Aperto il {formatDate(ticket.created_at)}
              </p>
            </div>

            <span className="w-fit rounded-full bg-primary-fixed px-3 py-1.5 text-sm font-semibold text-primary">
              {statusLabel(ticket.status)}
            </span>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-7">
          <section className="rounded-2xl bg-surface-container-low p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              La tua richiesta
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-on-surface">
              {ticket.body}
            </p>
          </section>

          <section>
            <h2 className="font-headline-sm text-xl text-primary">
              Conversazione
            </h2>

            <div className="mt-4 space-y-3">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant p-5 text-center text-on-surface-variant">
                  Non ci sono ancora risposte.
                </div>
              ) : (
                messages.map((message) => {
                  const fromAdmin = message.sender_role === "admin";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        fromAdmin ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={[
                          "max-w-[88%] rounded-2xl p-4 sm:max-w-[76%]",
                          fromAdmin
                            ? "rounded-tl-sm bg-surface-container-low text-on-surface"
                            : "rounded-tr-sm bg-primary text-white",
                        ].join(" ")}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
                          {fromAdmin ? "Il Tecnico di Fiducia" : "Tu"}
                        </p>
                        <p className="whitespace-pre-wrap break-words leading-6">
                          {message.body}
                        </p>
                        {message.attachments?.length ? (
                          <div className="mt-3 space-y-3">
                            {message.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="overflow-hidden rounded-xl border border-black/10 bg-white/10"
                              >
                                {attachment.file_type === "image" ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={attachment.signed_url}
                                    alt={attachment.file_name}
                                    className="max-h-72 w-full object-contain"
                                  />
                                ) : (
                                  <video
                                    src={attachment.signed_url}
                                    controls
                                    preload="metadata"
                                    className="max-h-72 w-full bg-black object-contain"
                                  />
                                )}

                                <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                                  <span className="min-w-0 truncate">
                                    {attachment.file_name}
                                  </span>

                                  <span className="shrink-0 opacity-70">
                                    {formatFileSize(attachment.file_size)}
                                  </span>
                                </div>

                                <a
                                  href={attachment.signed_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block border-t border-black/10 px-3 py-2 text-xs font-semibold underline underline-offset-2"
                                >
                                  Apri allegato
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <p className="mt-2 text-xs opacity-60">
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {closed ? (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 text-center">
              <p className="font-semibold text-primary">Ticket risolto</p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Questo ticket è stato chiuso. Puoi consultare la cronologia,
                ma non è più possibile inviare nuove risposte.
              </p>
            </div>
          ) : canReply ? (
            <section className="rounded-2xl border border-outline-variant/30 p-4 sm:p-5">
              <label
                htmlFor="guest-ticket-reply"
                className="font-label-md text-primary"
              >
                Scrivi una risposta
              </label>

              <p className="mt-2 text-sm text-on-surface-variant">
                Puoi inviare una risposta. Dopo l&apos;invio dovrai attendere una
                nuova risposta dell&apos;assistenza prima di poter scrivere ancora.
              </p>

              <textarea
                id="guest-ticket-reply"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                maxLength={5000}
                className="mt-3 min-h-32 w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                disabled={sending}
              />

              {error ? (
                <p className="mt-3 text-sm text-error">{error}</p>
              ) : null}

              <div className="mt-4">
                <label
                  htmlFor="guest-ticket-files"
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-outline-variant px-4 text-sm font-semibold text-primary transition hover:bg-surface-container-low"
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    aria-hidden
                  >
                    attach_file
                  </span>
                  Aggiungi immagini o video
                </label>

                <input
                  id="guest-ticket-files"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  className="sr-only"
                  disabled={sending}
                  onChange={(event) => {
                    handleFiles(event.target.files);
                    event.target.value = "";
                  }}
                />

                <p className="mt-2 text-xs text-on-surface-variant">
                  Massimo 10 file, 50 MB ciascuno. JPG, PNG, WebP, MP4 o MOV.
                </p>
              </div>

              {pendingAttachments.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pendingAttachments.map((attachment, index) => (
                    <div
                      key={`${attachment.file.name}-${index}`}
                      className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low"
                    >
                      {attachment.file.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachment.preview_url}
                          alt={attachment.file.name}
                          className="h-40 w-full object-contain"
                        />
                      ) : (
                        <video
                          src={attachment.preview_url}
                          controls
                          preload="metadata"
                          className="h-40 w-full bg-black object-contain"
                        />
                      )}

                      <div className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-on-surface">
                            {attachment.file.name}
                          </p>

                          <p className="text-xs text-on-surface-variant">
                            {formatFileSize(attachment.file.size)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removePendingAttachment(index)}
                          disabled={sending}
                          aria-label={`Rimuovi ${attachment.file.name}`}
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-error transition hover:bg-error/10 disabled:opacity-50"
                        >
                          <span
                            className="material-symbols-outlined text-[20px]"
                            aria-hidden
                          >
                            close
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {success ? (
                <p className="mt-3 text-sm text-primary">{success}</p>
              ) : null}

              {sending && uploadStage ? (
                <div className="mb-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-primary">
                      {uploadStage}
                    </span>

                    {uploadProgress !== null ? (
                      <span className="font-semibold text-primary">
                        {uploadProgress}%
                      </span>
                    ) : null}
                  </div>

                  {uploadProgress !== null ? (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-outline-variant/40">
                      <div
                        className="h-full rounded-full bg-[#FF8500] transition-[width] duration-200"
                        style={{
                          width: `${uploadProgress}%`,
                        }}
                        aria-hidden
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={sending || !reply.trim()}
                className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-6 font-button text-white transition hover:bg-[#FF9A2B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <span
                      className="material-symbols-outlined animate-spin text-[18px]"
                      aria-hidden
                    >
                      progress_activity
                    </span>
                    Caricamento…
                  </>
                ) : (
                  "Invia risposta"
                )}
              </button>
            </section>
          ) : waitingForAdmin ? (
            <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 text-center">
              <p className="font-semibold text-primary">
                Risposta inviata
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Attendi una nuova risposta dall&apos;assistenza. Quando sarà
                disponibile riceverai un&apos;email.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

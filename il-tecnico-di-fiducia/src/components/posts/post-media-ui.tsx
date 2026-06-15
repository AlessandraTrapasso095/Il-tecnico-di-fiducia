"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";

export type PostMediaAttachment = {
  id: string;
  public_url: string;
  media_type: "image" | "video";
  mime_type?: string | null;
  file_name?: string | null;
  file_size?: number | null;
};

export type PostEditable = {
  id: string;
  body: string;
  attachments?: PostMediaAttachment[];
};

export function ConfirmActionModal({
  title,
  body,
  confirmLabel,
  cancelLabel = "Annulla",
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/55 backdrop-blur-sm"
        aria-label="Chiudi modale"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="relative w-full max-w-[480px] rounded-[28px] border border-white/30 bg-surface-container-lowest p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low"
          aria-label="Chiudi"
          disabled={busy}
          onClick={onCancel}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
          <span className="material-symbols-outlined">delete</span>
        </div>
        <h2 className="mt-5 pr-10 font-headline-sm text-[26px] text-primary">
          {title}
        </h2>
        <p className="mt-2 text-on-surface-variant">{body}</p>
        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full px-5 py-3 font-button text-primary transition hover:bg-primary-fixed disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-full bg-error px-6 py-3 font-button text-white shadow-lg shadow-error/20 transition hover:opacity-90 disabled:opacity-60"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Eliminazione…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PostMediaViewer({
  attachment,
  onClose,
}: {
  attachment: PostMediaAttachment | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!attachment) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attachment, onClose]);

  if (!attachment) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-[#050b18]/85 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Chiudi anteprima"
        onClick={onClose}
      />
      <button
        type="button"
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-xl transition hover:bg-white"
        aria-label="Chiudi"
        onClick={onClose}
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[1180px] items-center justify-center">
        {attachment.media_type === "image" ? (
          <Image
            src={attachment.public_url}
            alt={attachment.file_name ?? "Allegato post"}
            width={1440}
            height={960}
            unoptimized
            className="max-h-[92vh] w-auto max-w-full rounded-[24px] object-contain shadow-2xl"
          />
        ) : (
          <video
            src={attachment.public_url}
            controls
            autoPlay
            className="max-h-[92vh] w-full max-w-[1180px] rounded-[24px] bg-black shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

export function PostAttachmentGrid({
  attachments,
  onOpen,
  className = "",
}: {
  attachments?: PostMediaAttachment[];
  onOpen: (attachment: PostMediaAttachment) => void;
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${className}`}>
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          className="group relative overflow-hidden rounded-2xl bg-primary/5 text-left"
          onClick={() => onOpen(attachment)}
        >
          {attachment.media_type === "image" ? (
            <Image
              src={attachment.public_url}
              alt={attachment.file_name ?? "Allegato post"}
              width={720}
              height={480}
              unoptimized
              className="h-full max-h-80 min-h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <video
              src={attachment.public_url}
              preload="metadata"
              muted
              className="h-full max-h-80 min-h-52 w-full bg-black object-cover"
            />
          )}
          <span className="absolute inset-0 bg-primary/0 transition group-hover:bg-primary/15" />
          <span className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary shadow-md">
            <span className="material-symbols-outlined">
              {attachment.media_type === "image" ? "open_in_full" : "play_arrow"}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function PostEditModal({
  post,
  busy,
  onCancel,
  onSave,
}: {
  post: PostEditable;
  busy?: boolean;
  onCancel: () => void;
  onSave: (
    body: string,
    removedAttachmentIds: string[],
    newFiles: File[],
  ) => Promise<void>;
}) {
  const [body, setBody] = useState(post.body);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setNewFiles((current) => [...current, ...selected]);
    event.target.value = "";
  }

  async function submit() {
    const cleanBody = body.replace(/\s+/g, " ").trim();
    if (!cleanBody) {
      setError("Il testo del post non può essere vuoto.");
      return;
    }

    setError(null);
    try {
      await onSave(cleanBody, removedAttachmentIds, newFiles);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Modifica non riuscita.");
    }
  }

  const visibleAttachments = (post.attachments ?? []).filter(
    (attachment) => !removedAttachmentIds.includes(attachment.id),
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/55 backdrop-blur-sm"
        aria-label="Chiudi modale"
        disabled={busy}
        onClick={onCancel}
      />
      <div className="relative max-h-[92vh] w-full max-w-[780px] overflow-y-auto rounded-[28px] bg-surface-container-lowest p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low"
          aria-label="Chiudi"
          disabled={busy}
          onClick={onCancel}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="pr-10 font-headline-sm text-[26px] text-primary">
          Modifica post
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Aggiorna testo e allegati reali del post.
        </p>

        <div className="mt-5 space-y-5">
          <label className="block font-label-md text-primary">
            Testo post
            <textarea
              className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 font-body-md outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={body}
              maxLength={1200}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-label-md text-primary">Allegati attuali</h3>
              <span className="text-sm text-on-surface-variant">
                {visibleAttachments.length} visibili
              </span>
            </div>
            {post.attachments && post.attachments.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {post.attachments.map((attachment) => {
                  const removed = removedAttachmentIds.includes(attachment.id);
                  return (
                    <div
                      key={attachment.id}
                      className={`relative overflow-hidden rounded-2xl border ${
                        removed
                          ? "border-error/30 bg-error-container/30 opacity-60"
                          : "border-outline-variant/40 bg-surface-container-low"
                      }`}
                    >
                      {attachment.media_type === "image" ? (
                        <Image
                          src={attachment.public_url}
                          alt={attachment.file_name ?? "Allegato post"}
                          width={520}
                          height={320}
                          unoptimized
                          className="h-44 w-full object-cover"
                        />
                      ) : (
                        <video
                          src={attachment.public_url}
                          preload="metadata"
                          muted
                          className="h-44 w-full bg-black object-cover"
                        />
                      )}
                      <div className="flex items-center justify-between gap-3 p-3">
                        <span className="truncate text-sm font-bold text-primary">
                          {attachment.file_name ??
                            (attachment.media_type === "image" ? "Foto" : "Video")}
                        </span>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-2 text-xs font-bold ${
                            removed
                              ? "text-primary hover:bg-primary-fixed"
                              : "text-error hover:bg-error-container"
                          }`}
                          disabled={busy}
                          onClick={() =>
                            setRemovedAttachmentIds((current) =>
                              removed
                                ? current.filter((id) => id !== attachment.id)
                                : [...current, attachment.id],
                            )
                          }
                        >
                          {removed ? "Ripristina" : "Rimuovi"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
                Nessun allegato presente.
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-label-md text-primary">Nuovi allegati</h3>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-fixed">
                <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                Aggiungi foto/video
                <input
                  type="file"
                  className="sr-only"
                  multiple
                  accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                  disabled={busy}
                  onChange={addFiles}
                />
              </label>
            </div>
            {newFiles.length > 0 ? (
              <div className="space-y-2">
                {newFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-3"
                  >
                    <span className="min-w-0 truncate text-sm text-on-surface-variant">
                      <strong className="text-primary">{file.name}</strong>{" "}
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      className="rounded-full px-3 py-2 text-xs font-bold text-error hover:bg-error-container"
                      disabled={busy}
                      onClick={() =>
                        setNewFiles((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
                Nessun nuovo file selezionato.
              </div>
            )}
          </section>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-full px-5 py-3 font-button text-primary hover:bg-primary-fixed disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
          >
            Annulla
          </button>
          <button
            type="button"
            className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-[#FF8500]/20 hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Salvataggio…" : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}

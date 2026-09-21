"use client";

import { useState, type ChangeEvent } from "react";

import { ConfirmActionModal } from "@/components/posts/post-media-ui";

type WorkAttachment = {
  id: string;
  public_url: string;
  media_type: "image" | "video";
  file_name: string | null;
};

type WorkPost = {
  id: string;
  body: string;
  attachments: WorkAttachment[];
};

const MAX_FILES = 6;
const MAX_FILE_SIZE = Math.floor(4.7 * 1024 * 1024);

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

function cleanBody(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function validateFiles(files: File[], existingCount = 0) {
  if (files.length + existingCount > MAX_FILES) {
    return `Puoi avere al massimo ${MAX_FILES} allegati per lavoro.`;
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return "Formato non supportato. Usa JPG, PNG, WebP, MP4 o MOV.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return `Il file "${file.name}" supera il limite di 4,7 MB.`;
    }
  }

  return null;
}

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return payload?.error ?? fallback;
}

async function uploadFiles(postId: string, files: File[]) {
  if (files.length === 0) {
    return;
  }

  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`/api/posts/${postId}/attachments`, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(
      await readError(response, "Upload degli allegati non riuscito."),
    );
  }
}

export function OwnerNewWorkButton() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);

    event.target.value = "";

    const validation = validateFiles(selected);

    if (validation) {
      setError(validation);
      return;
    }

    setFiles(selected);
    setError(null);
  }

  async function createWork() {
    const clean = cleanBody(body);

    if (!clean) {
      setError("Scrivi qualcosa prima di pubblicare.");
      return;
    }

    const validation = validateFiles(files);

    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          body: clean,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, "Pubblicazione non riuscita."),
        );
      }

      const payload = (await response.json()) as {
        post: {
          id: string;
        };
      };

      try {
        await uploadFiles(payload.post.id, files);
      } catch (uploadError) {
        await fetch(`/api/posts/${payload.post.id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });

        throw uploadError;
      }

      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Pubblicazione non riuscita.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#FF9A2B]"
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
        Nuovo lavoro
      </button>

      {open ? (
        <WorkEditorModal
          title="Nuovo lavoro"
          body={body}
          setBody={setBody}
          files={files}
          onFilesChange={selectFiles}
          busy={busy}
          error={error}
          onCancel={() => {
            if (busy) return;

            setOpen(false);
            setBody("");
            setFiles([]);
            setError(null);
          }}
          onConfirm={() => void createWork()}
          confirmLabel="Pubblica"
        />
      ) : null}
    </>
  );
}

export function OwnerPostActions({ post }: { post: WorkPost }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingAttachments = post.attachments.filter(
    (attachment) => !removedIds.includes(attachment.id),
  );

  function selectNewFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);

    event.target.value = "";

    const validation = validateFiles(selected, remainingAttachments.length);

    if (validation) {
      setError(validation);
      return;
    }

    setNewFiles(selected);
    setError(null);
  }

  async function updateWork() {
    const clean = cleanBody(body);

    if (!clean) {
      setError("Il testo del lavoro non può essere vuoto.");
      return;
    }

    const validation = validateFiles(newFiles, remainingAttachments.length);

    if (validation) {
      setError(validation);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      for (const attachmentId of removedIds) {
        const deleteResponse = await fetch(
          `/api/posts/${post.id}/attachments/${attachmentId}`,
          {
            method: "DELETE",
            credentials: "same-origin",
          },
        );

        if (!deleteResponse.ok) {
          throw new Error(
            await readError(
              deleteResponse,
              "Eliminazione di un allegato non riuscita.",
            ),
          );
        }
      }

      await uploadFiles(post.id, newFiles);

      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          body: clean,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Modifica non riuscita."));
      }

      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Modifica non riuscita.",
      );
      setBusy(false);
    }
  }

  async function deleteWork() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(
          await readError(response, "Eliminazione non riuscita."),
        );
      }

      window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Eliminazione non riuscita.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBody(post.body);
            setNewFiles([]);
            setRemovedIds([]);
            setError(null);
            setEditing(true);
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary-fixed disabled:opacity-50 sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          Modifica
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setDeleteOpen(true);
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-error transition hover:bg-error-container/40 disabled:opacity-50 sm:text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
          Elimina
        </button>
      </div>

      {editing ? (
        <WorkEditorModal
          title="Modifica lavoro"
          body={body}
          setBody={setBody}
          files={newFiles}
          onFilesChange={selectNewFiles}
          busy={busy}
          error={error}
          existingAttachments={remainingAttachments}
          onRemoveExisting={(id) => {
            setRemovedIds((current) => [...current, id]);
          }}
          onCancel={() => {
            if (busy) return;

            setEditing(false);
            setBody(post.body);
            setNewFiles([]);
            setRemovedIds([]);
            setError(null);
          }}
          onConfirm={() => void updateWork()}
          confirmLabel="Salva modifiche"
        />
      ) : null}

      {deleteOpen ? (
        <ConfirmActionModal
          title="Eliminare questo lavoro?"
          body="Il post e tutti i suoi allegati verranno eliminati definitivamente."
          confirmLabel="Elimina lavoro"
          busy={busy}
          error={error}
          onCancel={() => {
            if (busy) return;
            setDeleteOpen(false);
            setError(null);
          }}
          onConfirm={() => void deleteWork()}
        />
      ) : null}
    </>
  );
}

function WorkEditorModal({
  title,
  body,
  setBody,
  files,
  onFilesChange,
  busy,
  error,
  existingAttachments = [],
  onRemoveExisting,
  onCancel,
  onConfirm,
  confirmLabel,
}: {
  title: string;
  body: string;
  setBody: (value: string) => void;
  files: File[];
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  busy: boolean;
  error: string | null;
  existingAttachments?: WorkAttachment[];
  onRemoveExisting?: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-5"
    >
      <div className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm" />

      <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[760px] overflow-y-auto rounded-[24px] bg-surface-container-lowest p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline-sm text-[25px] text-primary">
              {title}
            </h2>

            <p className="mt-1 text-sm text-on-surface-variant">
              Puoi aggiungere testo e fino a 6 foto o video.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Chiudi"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary-fixed disabled:opacity-50"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <textarea
          value={body}
          maxLength={1200}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Racconta un lavoro, un progetto o un aggiornamento professionale..."
          className="mt-5 min-h-36 w-full resize-y rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <div className="mt-5">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary-fixed">
            <span className="material-symbols-outlined text-[20px]">
              add_photo_alternate
            </span>
            Foto / Video
            <input
              type="file"
              multiple
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              onChange={onFilesChange}
            />
          </label>

          <p className="mt-2 text-xs leading-5 text-on-surface-variant">
            Massimo 6 allegati. JPG, PNG, WebP, MP4 o MOV. Massimo 4,7 MB per
            file.
          </p>
        </div>

        {existingAttachments.length > 0 ? (
          <div className="mt-5">
            <div className="text-sm font-bold text-primary">
              Allegati attuali
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {existingAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-primary">
                      {attachment.file_name ??
                        (attachment.media_type === "video"
                          ? "Video"
                          : "Immagine")}
                    </div>

                    <div className="mt-0.5 text-xs text-on-surface-variant">
                      {attachment.media_type === "video" ? "Video" : "Immagine"}
                    </div>
                  </div>

                  {onRemoveExisting ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveExisting(attachment.id)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-error transition hover:bg-error-container/40 disabled:opacity-50"
                      aria-label="Rimuovi allegato"
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        close
                      </span>
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {files.length > 0 ? (
          <div className="mt-5 rounded-2xl bg-surface-container-low p-4">
            <div className="text-sm font-bold text-primary">Nuovi allegati</div>

            <ul className="mt-2 space-y-1 text-sm text-on-surface-variant">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`} className="truncate">
                  {file.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-full px-6 py-2.5 font-bold text-primary transition hover:bg-primary-fixed disabled:opacity-50"
          >
            Annulla
          </button>

          <button
            type="button"
            disabled={busy || !cleanBody(body)}
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-7 py-2.5 font-bold text-white transition hover:bg-[#FF9A2B] disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[19px]">
                  progress_activity
                </span>
                Salvataggio…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

import { ConfirmActionModal } from "./post-media-ui";

type CommentAuthor = {
  id: string;
  first_name: string;
  last_name: string;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: CommentAuthor | null;
};

type CommentsResponse = {
  comments: CommentRow[];
};

type PostCommentsProps = {
  postId: string;
  viewerId: string;
  onCountChange?: (delta: number) => void;
};

function fullName(person: CommentAuthor | null | undefined) {
  if (!person) return "Utente";
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Utente";
}

export function PostComments({ postId, viewerId, onCountChange }: PostCommentsProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [deleteTargetComment, setDeleteTargetComment] = useState<CommentRow | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<CommentsResponse>(
        `/api/posts/${postId}/comments?limit=80`,
        { method: "GET" },
      );
      setComments(response.comments ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Commenti non disponibili.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadComments();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [loadComments]);

  async function addComment() {
    const clean = body.replace(/\s+/g, " ").trim();
    if (!clean) return;

    setError(null);
    try {
      const response = await fetchJson<{ comment: CommentRow }>(
        `/api/posts/${postId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body: clean }),
        },
      );
      setComments((current) => [...current, response.comment]);
      setBody("");
      onCountChange?.(1);
    } catch (commentError) {
      setError(
        commentError instanceof Error ? commentError.message : "Commento non pubblicato.",
      );
    }
  }

  async function updateComment(commentId: string) {
    const clean = editingBody.replace(/\s+/g, " ").trim();
    if (!clean) return;

    setError(null);
    try {
      const response = await fetchJson<{ comment: CommentRow }>(
        `/api/post-comments/${commentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ body: clean }),
        },
      );
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId ? { ...comment, ...response.comment } : comment,
        ),
      );
      setEditingId(null);
      setEditingBody("");
    } catch (commentError) {
      setError(
        commentError instanceof Error ? commentError.message : "Commento non modificato.",
      );
    }
  }

  async function deleteComment(commentId: string) {
    setDeleteError(null);
    setDeletingCommentId(commentId);
    try {
      await fetchJson<{ ok: true }>(`/api/post-comments/${commentId}`, {
        method: "DELETE",
      });
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setDeleteTargetComment(null);
      onCountChange?.(-1);
    } catch (commentError) {
      setDeleteError(
        commentError instanceof Error ? commentError.message : "Commento non eliminato.",
      );
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <div className="mt-4 border-t border-outline-variant/30 pt-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-label-md text-primary">Commenti</h3>
        {loading ? <span className="text-xs text-on-surface-variant">Caricamento…</span> : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
          {error}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {comments.length === 0 && !loading ? (
          <p className="rounded-2xl bg-white/70 p-3 text-sm text-on-surface-variant">
            Nessun commento ancora.
          </p>
        ) : null}

        {comments.map((comment) => {
          const ownComment = comment.author_id === viewerId;
          return (
            <div key={comment.id} className="rounded-2xl bg-white/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-label-md text-sm text-primary">
                    {fullName(comment.author)}
                  </div>
                  {editingId === comment.id ? (
                    <textarea
                      className="mt-2 min-h-20 w-full resize-none rounded-xl border border-outline-variant px-3 py-2 outline-none focus:border-primary"
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                    />
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface-variant">
                      {comment.body}
                    </p>
                  )}
                </div>

                {ownComment ? (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {editingId === comment.id ? (
                      <button
                        type="button"
                        className="rounded-full px-3 py-1 text-xs font-bold text-primary hover:bg-primary-fixed"
                        onClick={() => void updateComment(comment.id)}
                      >
                        Salva
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-full px-3 py-1 text-xs font-bold text-primary hover:bg-primary-fixed"
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditingBody(comment.body);
                        }}
                      >
                        Modifica
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-full px-3 py-1 text-xs font-bold text-error hover:bg-error-container/40"
                      onClick={() => {
                        setDeleteTargetComment(comment);
                        setDeleteError(null);
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="min-h-11 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Scrivi un commento reale..."
        />
        <button
          type="button"
          className="rounded-full bg-primary px-5 py-2.5 font-button text-white transition hover:bg-primary-container"
          onClick={() => void addComment()}
        >
          Commenta
        </button>
      </div>

      {deleteTargetComment ? (
        <ConfirmActionModal
          title="Eliminare questo commento?"
          body="Questa azione non può essere annullata."
          confirmLabel="Elimina commento"
          busy={deletingCommentId === deleteTargetComment.id}
          error={deleteError}
          onCancel={() => {
            setDeleteTargetComment(null);
            setDeleteError(null);
          }}
          onConfirm={() => void deleteComment(deleteTargetComment.id)}
        />
      ) : null}
    </div>
  );
}

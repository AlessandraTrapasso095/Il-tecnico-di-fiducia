"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  ConfirmActionModal,
  PostAttachmentGrid,
  PostEditModal,
  PostMediaViewer,
  type PostMediaAttachment,
} from "@/components/posts/post-media-ui";
import { fetchJson } from "@/lib/api/fetch-json";

type ProfessionalProfileLite = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  province_code: string | null;
  phone: string | null;
};

type SubscriptionStatus = "none" | "stripe_active" | "admin_forced_active" | "suspended";

type SubscriptionResponse = {
  subscription: {
    professional_id: string;
    status: SubscriptionStatus;
    current_period_end: string | null;
    updated_at: string | null;
  } | null;
  is_active: boolean;
};

type PostAuthor = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  headline: string | null;
  province_code: string | null;
};

type PostAttachment = PostMediaAttachment & {
  id: string;
  public_url: string;
  media_type: "image" | "video";
  mime_type: string;
};

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  author: PostAuthor | null;
  attachments?: PostAttachment[];
};

type PostsResponse = {
  posts: PostRow[];
};

type ProfessionalDashboardClientProps = {
  profile: ProfessionalProfileLite;
};

const SUBSCRIPTION_SETTINGS_PATH = "/professionista/impostazioni/abbonamento";

function fullName(person: { first_name: string; last_name: string } | null | undefined) {
  if (!person) return "Utente";
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Utente";
}

function initials(person: { first_name: string; last_name: string }) {
  const first = person.first_name.trim().slice(0, 1).toUpperCase();
  const last = person.last_name.trim().slice(0, 1).toUpperCase();
  return `${first}${last}` || "P";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string | null | undefined) {
  if (!value) return "Nessun messaggio";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function subscriptionCardCopy(
  subscription: SubscriptionResponse | null,
): {
  title: string;
  body: string;
  dateLabel: string;
  buttonLabel: string;
  className: string;
  iconClassName: string;
  icon: string;
} {
  const status = subscription?.subscription?.status ?? "none";

  if (status === "stripe_active") {
    return {
      title: "Abbonamento attivo",
      body: "Il profilo è visibile e contattabile dai clienti secondo le regole piattaforma.",
      dateLabel: "Prossimo rinnovo",
      buttonLabel: "Gestisci abbonamento",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      iconClassName: "bg-emerald-500 text-white",
      icon: "verified",
    };
  }

  if (status === "admin_forced_active") {
    return {
      title: "Abbonamento attivo forzato da admin",
      body: "La visibilità è stata abilitata manualmente da un amministratore.",
      dateLabel: "Fine/rinnovo",
      buttonLabel: "Gestisci abbonamento",
      className: "border-lime-200 bg-lime-50 text-lime-950",
      iconClassName: "bg-lime-600 text-white",
      icon: "admin_panel_settings",
    };
  }

  if (status === "suspended") {
    return {
      title: "Abbonamento sospeso",
      body: "Riattiva l’abbonamento per tornare visibile e contattabile dai clienti.",
      dateLabel: "Fine ultimo periodo",
      buttonLabel: "Riattiva abbonamento",
      className: "border-amber-200 bg-amber-50 text-amber-950",
      iconClassName: "bg-amber-500 text-white",
      icon: "pause_circle",
    };
  }

  return {
    title: "Abbonamento non attivo",
    body: "Abbonati per farti vedere e contattare dai clienti.",
    dateLabel: "Scadenza",
    buttonLabel: "Attiva abbonamento",
    className: "border-red-200 bg-red-50 text-red-950",
    iconClassName: "bg-red-600 text-white",
    icon: "visibility_off",
  };
}

function Avatar({
  person,
  size = "md",
}: {
  person: { first_name: string; last_name: string; avatar_url?: string | null };
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-14 w-14" : size === "sm" ? "h-10 w-10" : "h-12 w-12";

  if (person.avatar_url) {
    return (
      <Image
        src={person.avatar_url}
        alt={fullName(person)}
        width={56}
        height={56}
        unoptimized
        className={`${sizeClass} rounded-full border-2 border-primary-container object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white`}
    >
      {initials(person)}
    </div>
  );
}

export default function ProfessionalDashboardClient({
  profile,
}: ProfessionalDashboardClientProps) {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postBody, setPostBody] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [postError, setPostError] = useState<string | null>(null);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [deleteTargetPost, setDeleteTargetPost] = useState<PostRow | null>(null);
  const [mediaViewerAttachment, setMediaViewerAttachment] =
    useState<PostMediaAttachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const subscriptionCopy = subscriptionCardCopy(subscription);

  const fetchDashboardData = useCallback(async () => {
    const [subscriptionRes, postsRes] = await Promise.all([
      fetchJson<SubscriptionResponse>("/api/subscription", { method: "GET" }),
      fetchJson<PostsResponse>("/api/posts?feed=following&page_size=30", {
        method: "GET",
      }),
    ]);

    return { subscriptionRes, postsRes };
  }, []);

  const applyDashboardData = useCallback((data: Awaited<ReturnType<typeof fetchDashboardData>>) => {
    setSubscription(data.subscriptionRes);
    setPosts(data.postsRes.posts ?? []);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setDashboardError(null);
    try {
      applyDashboardData(await fetchDashboardData());
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Impossibile caricare la dashboard.");
    } finally {
      setLoading(false);
    }
  }, [applyDashboardData, fetchDashboardData]);

  useEffect(() => {
    let mounted = true;

    fetchDashboardData()
      .then((data) => {
        if (!mounted) return;
        applyDashboardData(data);
        setDashboardError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setDashboardError(
          err instanceof Error ? err.message : "Impossibile caricare la dashboard.",
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [applyDashboardData, fetchDashboardData]);

  async function uploadPostFiles(postId: string, files: File[]) {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const response = await fetch(`/api/posts/${postId}/attachments`, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Upload media non riuscito.");
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostError(null);

    const body = postBody.replace(/\s+/g, " ").trim();
    if (!body) {
      setPostError("Scrivi qualcosa prima di pubblicare.");
      return;
    }

    setPosting(true);
    try {
      const created = await fetchJson<{ post: PostRow }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const files = [...photoFiles, ...videoFiles];
      await uploadPostFiles(created.post.id, files);
      setPostBody("");
      setPhotoFiles([]);
      setVideoFiles([]);
      await loadDashboard();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Impossibile creare il post.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(post: PostRow) {
    setBusyPostId(post.id);
    try {
      await fetchJson<{ ok: true }>(`/api/posts/${post.id}/likes`, {
        method: post.liked_by_me ? "DELETE" : "POST",
      });
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: !post.liked_by_me,
                likes_count: Math.max(
                  0,
                  item.likes_count + (post.liked_by_me ? -1 : 1),
                ),
              }
            : item,
        ),
      );
    } finally {
      setBusyPostId(null);
    }
  }

  async function addComment(postId: string) {
    const body = (commentDrafts[postId] ?? "").replace(/\s+/g, " ").trim();
    if (!body) return;

    setBusyPostId(postId);
    try {
      await fetchJson<{ comment: unknown }>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments_count: post.comments_count + 1 }
            : post,
        ),
      );
    } finally {
      setBusyPostId(null);
    }
  }

  async function savePostEdit(
    postId: string,
    bodyValue: string,
    removedAttachmentIds: string[],
    newFiles: File[],
  ) {
    const body = bodyValue.replace(/\s+/g, " ").trim();
    if (!body) return;

    setBusyPostId(postId);
    setPostActionError(null);
    try {
      const response = await fetchJson<{ post: PostRow }>(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      });
      for (const attachmentId of removedAttachmentIds) {
        await fetchJson<{ ok: true }>(
          `/api/posts/${postId}/attachments/${attachmentId}`,
          { method: "DELETE" },
        );
      }
      await uploadPostFiles(postId, newFiles);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, body: response.post.body, updated_at: response.post.updated_at }
            : post,
        ),
      );
      setEditingPost(null);
      await loadDashboard();
    } finally {
      setBusyPostId(null);
    }
  }

  async function deletePost(postId: string) {
    setBusyPostId(postId);
    setPostActionError(null);
    try {
      await fetchJson<{ ok: true }>(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((current) => current.filter((post) => post.id !== postId));
      setDeleteTargetPost(null);
    } catch (error) {
      setPostActionError(error instanceof Error ? error.message : "Eliminazione non riuscita.");
      throw error;
    } finally {
      setBusyPostId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8">
      <section
        className={`mb-6 rounded-[28px] border p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6 ${subscriptionCopy.className}`}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${subscriptionCopy.iconClassName}`}
            >
              <span className="material-symbols-outlined">{subscriptionCopy.icon}</span>
            </div>
            <div>
              <h1 className="font-headline-sm text-[22px] sm:text-headline-sm">
                {subscriptionCopy.title}
              </h1>
              <p className="mt-1 max-w-2xl font-body-md text-body-md opacity-85">
                {subscriptionCopy.body}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-white/65 px-4 py-3 text-sm">
              <div className="font-label-md text-[11px] uppercase tracking-[0.14em] opacity-70">
                {subscriptionCopy.dateLabel}
              </div>
              <div className="font-button">
                {formatDate(subscription?.subscription?.current_period_end)}
              </div>
            </div>
            <Link
              href={SUBSCRIPTION_SETTINGS_PATH}
              className="rounded-full bg-[#FF8500] px-6 py-3 text-center font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B]"
            >
              {subscriptionCopy.buttonLabel}
            </Link>
          </div>
        </div>
      </section>

      {dashboardError ? (
        <div className="mb-6 rounded-[24px] border border-error/20 bg-error-container p-5 text-on-error-container">
          {dashboardError}
        </div>
      ) : null}

      <section className="space-y-5">
        <form
          onSubmit={createPost}
          className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6"
        >
          <div className="flex gap-4">
            <Avatar person={profile} size="sm" />
            <div className="flex-1">
              <label className="sr-only" htmlFor="post-body">
                Crea un post
              </label>
              <textarea
                id="post-body"
                className="min-h-24 w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 font-body-md text-body-md outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={postBody}
                onChange={(event) => setPostBody(event.target.value)}
                placeholder="Condividi un aggiornamento professionale..."
                maxLength={1200}
              />
            </div>
          </div>
          {postError ? (
            <div className="mt-3 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
              {postError}
            </div>
          ) : null}
          {photoFiles.length > 0 || videoFiles.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              <span className="font-bold text-primary">File selezionati:</span>{" "}
              {[...photoFiles, ...videoFiles].map((file) => file.name).join(", ")}
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-4 border-t border-outline-variant/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="post-photos"
                className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-secondary transition hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[20px]">image</span>
                Foto
              </label>
              <input
                id="post-photos"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
              />
              <label
                htmlFor="post-videos"
                className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-secondary transition hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[20px]">videocam</span>
                Video
              </label>
              <input
                id="post-videos"
                type="file"
                accept="video/mp4,video/quicktime"
                multiple
                className="sr-only"
                onChange={(event) => setVideoFiles(Array.from(event.target.files ?? []))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-on-surface-variant">
                {postBody.trim().length}/1200
              </span>
              <button
                type="submit"
                disabled={posting}
                className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-button text-white shadow-md transition hover:bg-[#FF9A2B] disabled:opacity-60"
              >
                {posting ? "Pubblicazione…" : "Pubblica"}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="font-label-md text-[12px] uppercase tracking-[0.16em] text-on-tertiary-container">
                Feed
              </span>
              <h2 className="font-headline-md text-headline-md text-primary">
                Post dei professionisti
              </h2>
            </div>
            {loading ? (
              <span className="text-sm text-on-surface-variant">Caricamento…</span>
            ) : null}
          </div>

          {posts.length === 0 ? (
            <div className="rounded-[24px] border-2 border-dashed border-outline-variant p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <span className="material-symbols-outlined">article</span>
              </div>
              <h3 className="mt-4 font-headline-sm text-[22px] text-primary">
                Nessun post ancora
              </h3>
              <p className="mx-auto mt-2 w-full max-w-[560px] text-on-surface-variant">
                Qui compariranno i tuoi post e quelli dei professionisti che segui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {postActionError ? (
                <div className="rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
                  {postActionError}
                </div>
              ) : null}
              {posts.map((post) => {
                const isAuthor = post.author_id === profile.id;
                return (
                  <article
                    key={post.id}
                    className="rounded-[24px] border border-outline-variant/30 bg-surface-container-low p-4 sm:p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <Avatar
                          person={
                            post.author ?? {
                              first_name: "Professionista",
                              last_name: "",
                              avatar_url: null,
                            }
                          }
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-label-md text-primary">
                            {fullName(post.author)}
                          </div>
                          <div className="line-clamp-1 text-sm text-on-surface-variant">
                            {post.author?.headline ?? "Professionista"}
                          </div>
                          <div className="mt-1 text-xs text-on-surface-variant">
                            {formatTime(post.created_at)}
                          </div>
                        </div>
                      </div>

                      {isAuthor ? (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            className="rounded-full px-3 py-2 text-sm font-bold text-primary hover:bg-primary-fixed"
                            onClick={() => setEditingPost(post)}
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            className="rounded-full px-3 py-2 text-sm font-bold text-error hover:bg-error-container/40"
                            disabled={busyPostId === post.id}
                            onClick={() => setDeleteTargetPost(post)}
                          >
                            Elimina
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <p className="whitespace-pre-wrap font-body-md text-body-md text-on-surface">
                      {post.body}
                    </p>

                    <PostAttachmentGrid
                      attachments={post.attachments}
                      onOpen={setMediaViewerAttachment}
                    />

                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-outline-variant/30 pt-4">
                      <button
                        type="button"
                        disabled={busyPostId === post.id}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                          post.liked_by_me
                            ? "bg-primary text-white"
                            : "bg-surface-container-lowest text-primary hover:bg-primary-fixed"
                        }`}
                        onClick={() => void toggleLike(post)}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          thumb_up
                        </span>
                        Mi piace · {post.likes_count}
                      </button>
                      <span className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-sm font-bold text-on-surface-variant">
                        <span className="material-symbols-outlined text-[20px]">
                          chat_bubble
                        </span>
                        Commenti · {post.comments_count}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        className="min-h-11 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={commentDrafts[post.id] ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                        placeholder="Scrivi un commento reale..."
                      />
                      <button
                        type="button"
                        disabled={busyPostId === post.id}
                        className="rounded-full bg-primary px-5 py-2.5 font-button text-white transition hover:bg-primary-container disabled:opacity-60"
                        onClick={() => void addComment(post.id)}
                      >
                        Commenta
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {deleteTargetPost ? (
        <ConfirmActionModal
          title="Eliminare questo post?"
          body="Questa azione non può essere annullata."
          confirmLabel="Elimina post"
          busy={busyPostId === deleteTargetPost.id}
          error={postActionError}
          onCancel={() => {
            setDeleteTargetPost(null);
            setPostActionError(null);
          }}
          onConfirm={() => void deletePost(deleteTargetPost.id)}
        />
      ) : null}

      {editingPost ? (
        <PostEditModal
          post={editingPost}
          busy={busyPostId === editingPost.id}
          onCancel={() => setEditingPost(null)}
          onSave={(body, removedAttachmentIds, newFiles) =>
            savePostEdit(editingPost.id, body, removedAttachmentIds, newFiles)
          }
        />
      ) : null}

      <PostMediaViewer
        attachment={mediaViewerAttachment}
        onClose={() => setMediaViewerAttachment(null)}
      />
    </div>
  );
}

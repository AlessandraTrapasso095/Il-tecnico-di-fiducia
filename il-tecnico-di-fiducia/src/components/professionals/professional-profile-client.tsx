"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";

import {
  ConfirmActionModal,
  PostAttachmentGrid,
  PostEditModal,
  PostMediaViewer,
  type PostMediaAttachment,
} from "@/components/posts/post-media-ui";
import { fetchJson } from "@/lib/api/fetch-json";
import { ITALIAN_PROVINCES } from "@/lib/locations/italian-provinces";
import type {
  ProfessionalProfileAccess,
  ProfessionalProfileDetails,
} from "@/lib/server/professional-profile";

type TabKey = "bio" | "works" | "reviews";
type MediaTarget = "avatar" | "cover";
type EditSection =
  | "intro"
  | "services"
  | "contact"
  | "education"
  | "work"
  | "certifications";

type Viewer = {
  id: string;
  role: "customer" | "professional" | "admin";
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
  attachments?: PostAttachment[];
};

type PostsResponse = {
  posts: PostRow[];
};

type ReviewRow = {
  id: string;
  request_id: string;
  professional_id: string;
  customer_id: string;
  rating: number;
  body: string;
  professional_reply: string | null;
  professional_replied_at: string | null;
  created_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

type ReviewsResponse = {
  reviews: ReviewRow[];
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: { id: string; first_name: string; last_name: string } | null;
};

type CommentsResponse = {
  comments: CommentRow[];
};

type ProfessionalProfileClientProps = {
  initialProfile: ProfessionalProfileDetails;
  access: ProfessionalProfileAccess;
  viewer: Viewer;
  embeddedInProfessionalShell?: boolean;
};

const EMPTY_COVER =
  "linear-gradient(135deg, rgba(0,38,84,0.96), rgba(11,60,120,0.72)), radial-gradient(circle at 70% 30%, rgba(255,136,20,0.22), transparent 30%)";

function fullName(person: { first_name: string; last_name: string }) {
  return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || "Professionista";
}

function initials(person: { first_name: string; last_name: string }) {
  return (
    `${person.first_name?.trim().slice(0, 1) ?? ""}${person.last_name?.trim().slice(0, 1) ?? ""}`
      .toUpperCase()
      .trim() || "P"
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function provinceName(code: string | null | undefined) {
  if (!code) return "Provincia non indicata";
  return ITALIAN_PROVINCES.find((province) => province.code === code)?.name ?? code;
}

function listFromJson(items: unknown[]) {
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      const row = item as Record<string, unknown>;
      return String(row.text ?? row.title ?? row.name ?? "").trim();
    })
    .filter(Boolean);
}

function jsonFromLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function linesFromJson(items: unknown[]) {
  return listFromJson(items).join("\n");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-outline-variant p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h3 className="mt-4 font-headline-sm text-[22px] text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-[560px] text-on-surface-variant">{body}</p>
    </div>
  );
}

function LockState({ isProfessionalViewer }: { isProfessionalViewer: boolean }) {
  return (
    <div className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-8 text-center shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-primary">
        <span className="material-symbols-outlined">lock</span>
      </div>
      <h2 className="mt-4 font-headline-sm text-[24px] text-primary">
        Profilo completo bloccato
      </h2>
      <p className="mx-auto mt-2 max-w-[560px] text-on-surface-variant">
        {isProfessionalViewer
          ? "Segui questo professionista per visualizzare Bio & CV, lavori e recensioni."
          : "Il profilo completo non è disponibile per il tuo account."}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  children,
  editable,
  onEdit,
}: {
  title: string;
  children: ReactNode;
  editable: boolean;
  onEdit?: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)] sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="font-headline-sm text-[24px] text-primary">{title}</h2>
        {editable ? (
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary-fixed"
            onClick={onEdit}
          >
            Modifica
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

async function cropImageToFile({
  file,
  target,
  zoom,
  offsetX,
  offsetY,
}: {
  file: File;
  target: MediaTarget;
  zoom: number;
  offsetX: number;
  offsetY: number;
}) {
  const bitmap = await createImageBitmap(file);
  const width = target === "avatar" ? 512 : 1600;
  const height = target === "avatar" ? 512 : 520;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");

  ctx.fillStyle = "#f9f9ff";
  ctx.fillRect(0, 0, width, height);

  const coverScale = Math.max(width / bitmap.width, height / bitmap.height) * zoom;
  const drawWidth = bitmap.width * coverScale;
  const drawHeight = bitmap.height * coverScale;
  const dx = (width - drawWidth) / 2 + offsetX;
  const dy = (height - drawHeight) / 2 + offsetY;

  ctx.drawImage(bitmap, dx, dy, drawWidth, drawHeight);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Impossibile preparare l’immagine.");
  return new File([blob], `${target}.jpg`, { type: "image/jpeg" });
}

export default function ProfessionalProfileClient({
  initialProfile,
  access,
  viewer,
  embeddedInProfessionalShell = false,
}: ProfessionalProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [profileAccess, setProfileAccess] = useState(access);
  const [tab, setTab] = useState<TabKey>("bio");
  const [mediaMenu, setMediaMenu] = useState<MediaTarget | null>(null);
  const [cropState, setCropState] = useState<{
    target: MediaTarget;
    file: File;
    previewUrl: string;
    zoom: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [editSection, setEditSection] = useState<EditSection | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string | boolean>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postBody, setPostBody] = useState("");
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactFiles, setContactFiles] = useState<File[]>([]);
  const [contactPrivacy, setContactPrivacy] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const coverMenuRef = useRef<HTMLDivElement | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const coverMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const avatarMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mediaMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const pendingMediaTargetRef = useRef<MediaTarget | null>(null);

  const isOwner = profileAccess.is_owner;
  const canViewFull = profileAccess.can_view_full_profile;
  const contactEmail = profile.public_email || profile.email;
  const shellOffset = embeddedInProfessionalShell ? "" : "min-h-screen bg-background";

  const services = profile.services_offered.length
    ? profile.services_offered
    : profile.specializations;

  const hasReviewByViewer = reviews.some((review) => review.customer_id === viewer.id);

  const averageRatingLabel = profile.rating_average
    ? profile.rating_average.toFixed(1)
    : "—";

  const loadPosts = useCallback(
    async () => {
      if (!canViewFull) return;
      setPostsLoading(true);
      try {
        const response = await fetchJson<PostsResponse>(
          `/api/posts?author_id=${encodeURIComponent(profile.id)}&page_size=30`,
          { method: "GET" },
        );
        setPosts(response.posts ?? []);
      } catch {
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    },
    [canViewFull, profile.id],
  );

  const loadReviews = useCallback(
    async () => {
      if (!canViewFull) return;
      setReviewsLoading(true);
      try {
        const response = await fetchJson<ReviewsResponse>(
          `/api/reviews?professional_id=${encodeURIComponent(profile.id)}&page_size=50`,
          { method: "GET" },
        );
        setReviews(response.reviews ?? []);
      } catch {
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    },
    [canViewFull, profile.id],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadPosts();
      void loadReviews();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadPosts, loadReviews]);

  useEffect(() => {
    if (!mediaMenu) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const activeRef = mediaMenu === "cover" ? coverMenuRef : avatarMenuRef;
      if (!activeRef.current?.contains(target) && !mediaMenuPortalRef.current?.contains(target)) {
        setMediaMenu(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mediaMenu]);

  function openEdit(section: EditSection) {
    setEditSection(section);
    setProfileError(null);
    setEditDraft({
      first_name: profile.first_name,
      last_name: profile.last_name,
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      province_code: profile.province_code ?? "",
      phone: profile.phone ?? "",
      public_email: profile.public_email ?? "",
      specializations: profile.specializations.join("\n"),
      services_offered: profile.services_offered.join("\n"),
      education: linesFromJson(profile.education),
      work_experiences: linesFromJson(profile.work_experiences),
      certifications: linesFromJson(profile.certifications),
      available_remote: profile.available_remote,
      available_travel: profile.available_travel,
      operational_provinces: profile.operational_provinces.join("\n"),
    });
  }

  async function saveEdit() {
    if (!editSection) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (editSection === "intro") {
        payload.first_name = editDraft.first_name;
        payload.last_name = editDraft.last_name;
        payload.headline = editDraft.headline;
        payload.bio = editDraft.bio;
        payload.province_code = editDraft.province_code || null;
        payload.available_remote = Boolean(editDraft.available_remote);
        payload.available_travel = Boolean(editDraft.available_travel);
      }
      if (editSection === "services") {
        payload.services_offered = splitLines(String(editDraft.services_offered ?? ""));
        payload.specializations = splitLines(String(editDraft.specializations ?? ""));
      }
      if (editSection === "contact") {
        payload.phone = editDraft.phone || null;
        payload.public_email = editDraft.public_email || null;
      }
      if (editSection === "education") {
        payload.education = jsonFromLines(String(editDraft.education ?? ""));
      }
      if (editSection === "work") {
        payload.work_experiences = jsonFromLines(String(editDraft.work_experiences ?? ""));
      }
      if (editSection === "certifications") {
        payload.certifications = jsonFromLines(String(editDraft.certifications ?? ""));
      }
      await fetchJson<{ professional: unknown }>(`/api/professionals/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setProfile((current) => ({
        ...current,
        first_name: String(payload.first_name ?? current.first_name),
        last_name: String(payload.last_name ?? current.last_name),
        headline:
          "headline" in payload ? (payload.headline as string | null) : current.headline,
        bio: "bio" in payload ? (payload.bio as string | null) : current.bio,
        province_code:
          "province_code" in payload
            ? (payload.province_code as string | null)
            : current.province_code,
        phone: "phone" in payload ? (payload.phone as string | null) : current.phone,
        public_email:
          "public_email" in payload
            ? (payload.public_email as string | null)
            : current.public_email,
        specializations:
          (payload.specializations as string[] | undefined) ?? current.specializations,
        services_offered:
          (payload.services_offered as string[] | undefined) ?? current.services_offered,
        education: (payload.education as unknown[] | undefined) ?? current.education,
        work_experiences:
          (payload.work_experiences as unknown[] | undefined) ?? current.work_experiences,
        certifications:
          (payload.certifications as unknown[] | undefined) ?? current.certifications,
        available_remote:
          typeof payload.available_remote === "boolean"
            ? payload.available_remote
            : current.available_remote,
        available_travel:
          typeof payload.available_travel === "boolean"
            ? payload.available_travel
            : current.available_travel,
        operational_provinces:
          (payload.operational_provinces as string[] | undefined) ??
          current.operational_provinces,
      }));
      setEditSection(null);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Salvataggio non riuscito.");
    } finally {
      setSavingProfile(false);
    }
  }

  function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const target = pendingMediaTargetRef.current ?? mediaMenu;
    pendingMediaTargetRef.current = null;
    if (!file || !target) return;
    const previewUrl = URL.createObjectURL(file);
    setMediaMenu(null);
    setCropState({ target, file, previewUrl, zoom: 1, offsetX: 0, offsetY: 0 });
  }

  function openMediaPicker(source: "camera" | "device") {
    if (!mediaMenu) return;
    pendingMediaTargetRef.current = mediaMenu;
    setMediaMenu(null);
    const input = source === "camera" ? cameraInputRef.current : fileInputRef.current;
    window.setTimeout(() => input?.click(), 0);
  }

  async function uploadCroppedImage() {
    if (!cropState) return;
    setProfileError(null);
    setUploadingImage(true);
    try {
      const cropped = await cropImageToFile(cropState);
      const formData = new FormData();
      formData.append("file", cropped);
      const endpoint =
        cropState.target === "avatar" ? "/api/uploads/avatar" : "/api/uploads/cover";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        avatar_url?: string;
        cover_url?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Upload non riuscito.");

      setProfile((current) => ({
        ...current,
        avatar_url: payload.avatar_url ?? current.avatar_url,
        cover_url: payload.cover_url ?? current.cover_url,
      }));
      if (cropState.target === "avatar") {
        window.dispatchEvent(
          new CustomEvent("professional-avatar-updated", {
            detail: { avatar_url: payload.avatar_url ?? null },
          }),
        );
      }
      URL.revokeObjectURL(cropState.previewUrl);
      setCropState(null);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Upload non riuscito.");
    } finally {
      setUploadingImage(false);
    }
  }

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

  async function createPost() {
    const body = postBody.replace(/\s+/g, " ").trim();
    if (!body) {
      setPostError("Scrivi qualcosa prima di pubblicare.");
      return;
    }
    setPosting(true);
    setPostError(null);
    try {
      const created = await fetchJson<{ post: { id: string } }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      await uploadPostFiles(created.post.id, postFiles);
      setPostBody("");
      setPostFiles([]);
      await loadPosts();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Pubblicazione non riuscita.");
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
                likes_count: Math.max(0, item.likes_count + (post.liked_by_me ? -1 : 1)),
              }
            : item,
        ),
      );
    } finally {
      setBusyPostId(null);
    }
  }

  async function deletePost(postId: string) {
    setBusyPostId(postId);
    try {
      await fetchJson<{ ok: true }>(`/api/posts/${postId}`, { method: "DELETE" });
      setPosts((current) => current.filter((post) => post.id !== postId));
    } finally {
      setBusyPostId(null);
    }
  }

  async function updatePost(
    postId: string,
    body: string,
    removedAttachmentIds: string[],
    newFiles: File[],
  ) {
    const cleanBody = body.replace(/\s+/g, " ").trim();
    if (!cleanBody) {
      setPostError("Il testo del post non può essere vuoto.");
      return;
    }

    setBusyPostId(postId);
    setPostError(null);
    try {
      const response = await fetchJson<{ post: PostRow }>(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: cleanBody }),
      });
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                body: response.post.body,
                updated_at: response.post.updated_at,
              }
            : post,
        ),
      );
      for (const attachmentId of removedAttachmentIds) {
        await fetchJson<{ ok: true }>(
          `/api/posts/${postId}/attachments/${attachmentId}`,
          { method: "DELETE" },
        );
      }
      await uploadPostFiles(postId, newFiles);
      await loadPosts();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Modifica non riuscita.");
      throw error;
    } finally {
      setBusyPostId(null);
    }
  }

  async function followOrUnfollow() {
    if (profileAccess.is_following) {
      await fetchJson<{ ok: true }>(`/api/follows/${profile.id}`, { method: "DELETE" });
      setProfileAccess((current) => ({
        ...current,
        is_following: false,
        can_view_full_profile: false,
        can_view_contacts: false,
      }));
      setPosts([]);
      setReviews([]);
      return;
    }

    await fetchJson<{ ok: true }>("/api/follows", {
      method: "POST",
      body: JSON.stringify({ followed_id: profile.id }),
    });
    setProfileAccess((current) => ({
      ...current,
      is_following: true,
      can_view_full_profile: true,
      can_view_contacts: true,
    }));
    window.setTimeout(() => {
      void loadPosts();
      void loadReviews();
    }, 0);
  }

  async function sendContactRequest() {
    setContactSending(true);
    setContactError(null);
    try {
      const created = await fetchJson<{ request: { id: string; status: string; created_at: string } }>(
        "/api/contact-requests",
        {
          method: "POST",
          body: JSON.stringify({
            professional_id: profile.id,
            subject: contactSubject,
            message: contactMessage,
            privacy_accepted: contactPrivacy,
          }),
        },
      );

      if (contactFiles.length > 0) {
        const formData = new FormData();
        contactFiles.forEach((file) => formData.append("files", file));
        const response = await fetch(`/api/contact-requests/${created.request.id}/attachments`, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Upload allegati non riuscito.");
      }

      setProfileAccess((current) => ({
        ...current,
        latest_contact_request: {
          id: created.request.id,
          status: created.request.status,
          created_at: created.request.created_at,
        },
      }));
      setContactDone(true);
    } catch (error) {
      setContactError(error instanceof Error ? error.message : "Richiesta non inviata.");
    } finally {
      setContactSending(false);
    }
  }

  async function submitReview() {
    const requestId = profileAccess.latest_contact_request?.id;
    if (!requestId) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      await fetchJson<{ review: ReviewRow }>("/api/reviews", {
        method: "POST",
        body: JSON.stringify({
          request_id: requestId,
          rating: reviewRating,
          body: reviewBody,
        }),
      });
      setReviewBody("");
      setReviewRating(5);
      await loadReviews();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Recensione non inviata.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function replyToReview(reviewId: string) {
    const body = (replyDrafts[reviewId] ?? "").replace(/\s+/g, " ").trim();
    if (!body) return;
    await fetchJson<{ review: { professional_reply: string; professional_replied_at: string } }>(
      `/api/reviews/${reviewId}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ body }),
      },
    );
    setReplyDrafts((current) => ({ ...current, [reviewId]: "" }));
    await loadReviews();
  }

  const containerClass = embeddedInProfessionalShell
    ? "mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8"
    : "mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8";

  return (
    <div className={shellOffset}>
      {!embeddedInProfessionalShell ? (
        <header className="sticky top-0 z-40 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md">
          <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="font-headline-sm text-[22px] text-primary">
              Il tecnico di fiducia
            </Link>
            <Link
              href={viewer.role === "customer" ? "/customer" : "/professionista"}
              className="rounded-full border border-primary px-5 py-2 font-button text-primary"
            >
              Torna all’area
            </Link>
          </div>
        </header>
      ) : null}

      <main className={containerClass}>
        {profileError ? (
          <div className="mb-4 rounded-2xl bg-error-container p-4 text-on-error-container">
            {profileError}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[32px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
          <div className="relative h-[260px] bg-primary sm:h-[320px]">
            {profile.cover_url ? (
              <Image
                src={profile.cover_url}
                alt="Immagine di copertina"
                fill
                unoptimized
                className="object-cover"
                priority
              />
            ) : (
              <div className="h-full w-full" style={{ background: EMPTY_COVER }} />
            )}
            <div className="absolute inset-0 bg-primary/20" />
            {isOwner ? (
              <div ref={coverMenuRef} className="absolute right-4 top-4">
                <button
                  ref={coverMenuButtonRef}
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-primary shadow-lg backdrop-blur"
                  onClick={() => setMediaMenu(mediaMenu === "cover" ? null : "cover")}
                  aria-label="Modifica cover"
                  aria-expanded={mediaMenu === "cover"}
                >
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative px-5 pb-6 sm:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="relative -mt-16 h-36 w-36 rounded-full border-4 border-surface-container-lowest bg-primary shadow-xl sm:h-40 sm:w-40 md:-mt-20">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={fullName(profile)}
                      fill
                      unoptimized
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full text-4xl font-bold text-white">
                      {initials(profile)}
                    </div>
                  )}
                  {isOwner ? (
                    <div ref={avatarMenuRef} className="absolute bottom-2 right-2">
                      <button
                        ref={avatarMenuButtonRef}
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF8500] text-white shadow-lg"
                        onClick={() => setMediaMenu(mediaMenu === "avatar" ? null : "avatar")}
                        aria-label="Modifica foto profilo"
                        aria-expanded={mediaMenu === "avatar"}
                      >
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="pt-1 md:pt-6">
                  <h1 className="font-headline-md text-[34px] leading-tight text-primary sm:text-[42px]">
                    {fullName(profile)}
                  </h1>
                  <p className="mt-1 text-lg font-semibold text-on-surface-variant">
                    {profile.headline || "Professione non ancora indicata"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-on-surface-variant">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">place</span>
                      {provinceName(profile.province_code)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-[#FF8500]">
                        star
                      </span>
                      <strong className="text-primary">{averageRatingLabel}</strong>
                      ({profile.reviews_count} recensioni)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row md:pt-8">
                {viewer.role === "customer" && !isOwner ? (
                  <button
                    type="button"
                    className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-button text-white shadow-lg transition hover:bg-[#FF9A2B]"
                    onClick={() => setContactOpen(true)}
                  >
                    Contatta professionista
                  </button>
                ) : null}
                {viewer.role === "professional" && !isOwner ? (
                  <button
                    type="button"
                    className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-button text-white shadow-lg transition hover:bg-[#FF9A2B]"
                    onClick={() => void followOrUnfollow()}
                  >
                    {profileAccess.is_following ? "Non seguire più" : "Segui"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={onPickImage}
        />
        <input
          ref={cameraInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickImage}
        />
        {mediaMenu ? (
          <MediaMenu
            anchorRef={mediaMenu === "cover" ? coverMenuButtonRef : avatarMenuButtonRef}
            menuRef={mediaMenuPortalRef}
            onCamera={() => openMediaPicker("camera")}
            onDevice={() => openMediaPicker("device")}
          />
        ) : null}

        <div className="mt-8 border-b border-outline-variant/40">
          <div className="flex gap-3 overflow-x-auto">
            {[
              ["bio", "person", "Bio & CV"],
              ["works", "work", "Lavori"],
              ["reviews", "rate_review", "Recensioni"],
            ].map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                className={[
                  "flex items-center gap-2 border-b-2 px-3 py-4 font-button text-button transition",
                  tab === key
                    ? "border-[#FF8500] text-[#FF8500]"
                    : "border-transparent text-on-surface-variant hover:text-primary",
                ].join(" ")}
                onClick={() => setTab(key as TabKey)}
              >
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {!canViewFull ? (
              <LockState isProfessionalViewer={viewer.role === "professional"} />
            ) : tab === "bio" ? (
              <>
                <SectionCard
                  title="Informazioni personali e professionali"
                  editable={isOwner}
                  onEdit={() => openEdit("intro")}
                >
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoPill icon="badge" label="Nome" value={profile.first_name || "Non indicato"} />
                      <InfoPill icon="badge" label="Cognome" value={profile.last_name || "Non indicato"} />
                      <InfoPill
                        icon="engineering"
                        label="Professione"
                        value={profile.headline || "Non indicato"}
                      />
                      <InfoPill
                        icon="place"
                        label="Provincia"
                        value={profile.province_code ? provinceName(profile.province_code) : "Non indicato"}
                      />
                      <InfoPill
                        icon="language"
                        label="Disponibilità da remoto"
                        value={profile.available_remote ? "Disponibile" : "Non disponibile"}
                      />
                      <InfoPill
                        icon="commute"
                        label="Disponibilità a trasferte"
                        value={profile.available_travel ? "Disponibile" : "Non disponibile"}
                      />
                    </div>

                    <div>
                      <h3 className="font-label-md text-primary">Bio / descrizione professionale</h3>
                      {profile.bio ? (
                        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-on-surface-variant">
                          {profile.bio}
                        </p>
                      ) : (
                        <p className="mt-2 rounded-2xl bg-surface-container-low p-4 text-on-surface-variant">
                          Non indicato
                        </p>
                      )}
                    </div>

                  </div>
                </SectionCard>

                <SectionCard
                  title="Servizi offerti"
                  editable={isOwner}
                  onEdit={() => openEdit("services")}
                >
                  {services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {services.map((service) => (
                        <span
                          key={service}
                          className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-bold text-on-primary-fixed-variant"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="construction"
                      title="Nessun servizio indicato"
                      body="I servizi compariranno qui appena saranno aggiunti al profilo."
                    />
                  )}
                </SectionCard>

                <SectionCard
                  title="Studi e formazione"
                  editable={isOwner}
                  onEdit={() => openEdit("education")}
                >
                  <ListOrEmpty items={listFromJson(profile.education)} />
                </SectionCard>

                <SectionCard
                  title="Esperienze lavorative"
                  editable={isOwner}
                  onEdit={() => openEdit("work")}
                >
                  <ListOrEmpty items={listFromJson(profile.work_experiences)} />
                </SectionCard>

                <SectionCard
                  title="Certificazioni"
                  editable={isOwner}
                  onEdit={() => openEdit("certifications")}
                >
                  <ListOrEmpty items={listFromJson(profile.certifications)} />
                </SectionCard>

                <SectionCard
                  title="Dati di contatto"
                  editable={isOwner}
                  onEdit={() => openEdit("contact")}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoPill icon="phone" label="Telefono" value={profile.phone || "Non indicato"} />
                    <InfoPill icon="mail" label="Email" value={contactEmail || "Non indicato"} />
                  </div>
                </SectionCard>
              </>
            ) : tab === "works" ? (
              <WorksTab
                isOwner={isOwner}
                posts={posts}
                loading={postsLoading}
                postBody={postBody}
                setPostBody={setPostBody}
                postFiles={postFiles}
                setPostFiles={setPostFiles}
                posting={posting}
                postError={postError}
                createPost={() => void createPost()}
                toggleLike={toggleLike}
                updatePost={updatePost}
                deletePost={deletePost}
                busyPostId={busyPostId}
                viewerId={viewer.id}
              />
            ) : (
              <ReviewsTab
                isOwner={isOwner}
                reviews={reviews}
                loading={reviewsLoading}
                canReview={profileAccess.can_review && !hasReviewByViewer}
                reviewRating={reviewRating}
                setReviewRating={setReviewRating}
                reviewBody={reviewBody}
                setReviewBody={setReviewBody}
                submitting={reviewSubmitting}
                error={reviewError}
                submitReview={() => void submitReview()}
                replyDrafts={replyDrafts}
                setReplyDrafts={setReplyDrafts}
                replyToReview={(id) => void replyToReview(id)}
              />
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <span className="material-symbols-outlined">
                  {profileAccess.can_view_contacts ? "contact_mail" : "lock"}
                </span>
              </div>
              <h2 className="mt-4 font-headline-sm text-[22px] text-primary">
                Dati di contatto
              </h2>
              {!profileAccess.can_view_contacts ? (
                <p className="mt-2 text-sm text-on-surface-variant">
                  {viewer.role === "customer"
                    ? "Visibili dopo l’accettazione della tua richiesta."
                    : "Visibili dopo aver seguito questo professionista."}
                </p>
              ) : null}
              <div
                className={[
                  "mt-5 space-y-3 text-left",
                  profileAccess.can_view_contacts
                    ? ""
                    : "select-none opacity-35 blur-[2px]",
                ].join(" ")}
              >
                <InfoPill icon="phone" label="Telefono" value={profile.phone || "—"} />
                <InfoPill icon="mail" label="Email" value={contactEmail || "—"} />
              </div>
              {viewer.role === "customer" && !profileAccess.can_view_contacts ? (
                <button
                  type="button"
                  className="mt-6 w-full rounded-full border-2 border-primary px-5 py-3 font-button text-primary transition hover:bg-primary hover:text-white"
                  onClick={() => setContactOpen(true)}
                >
                  Richiedi contatto
                </button>
              ) : null}
            </section>
          </aside>
        </div>
      </main>

      {cropState ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-[720px] rounded-[28px] bg-surface-container-lowest p-5 shadow-2xl">
            <h2 className="font-headline-sm text-[24px] text-primary">Sistema immagine</h2>
            <div className="mt-4 overflow-hidden rounded-2xl bg-surface-container-low">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropState.previewUrl}
                alt="Anteprima"
                className={[
                  "mx-auto object-cover",
                  cropState.target === "avatar"
                    ? "aspect-square max-h-[360px] rounded-full"
                    : "aspect-[16/5] max-h-[320px] w-full",
                ].join(" ")}
                style={{
                  transform: `scale(${cropState.zoom}) translate(${cropState.offsetX / 8}px, ${cropState.offsetY / 8}px)`,
                }}
              />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Slider
                label="Zoom"
                min={1}
                max={2.2}
                step={0.05}
                value={cropState.zoom}
                onChange={(value) => setCropState((current) => current && { ...current, zoom: value })}
              />
              <Slider
                label="Destra/Sinistra"
                min={-160}
                max={160}
                step={1}
                value={cropState.offsetX}
                onChange={(value) =>
                  setCropState((current) => current && { ...current, offsetX: value })
                }
              />
              <Slider
                label="Alto/Basso"
                min={-160}
                max={160}
                step={1}
                value={cropState.offsetY}
                onChange={(value) =>
                  setCropState((current) => current && { ...current, offsetY: value })
                }
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full px-5 py-3 font-button text-primary hover:bg-primary-fixed"
                disabled={uploadingImage}
                onClick={() => {
                  URL.revokeObjectURL(cropState.previewUrl);
                  setCropState(null);
                }}
              >
                Annulla
              </button>
              <button
                type="button"
                className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white hover:bg-[#FF9A2B]"
                disabled={uploadingImage}
                onClick={() => void uploadCroppedImage()}
              >
                {uploadingImage ? "Caricamento…" : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editSection ? (
        <EditModal
          section={editSection}
          draft={editDraft}
          setDraft={setEditDraft}
          saving={savingProfile}
          error={profileError}
          onCancel={() => setEditSection(null)}
          onSave={() => void saveEdit()}
        />
      ) : null}

      {contactOpen ? (
        <ContactModal
          profile={profile}
          subject={contactSubject}
          setSubject={setContactSubject}
          message={contactMessage}
          setMessage={setContactMessage}
          files={contactFiles}
          setFiles={setContactFiles}
          privacy={contactPrivacy}
          setPrivacy={setContactPrivacy}
          sending={contactSending}
          done={contactDone}
          error={contactError}
          onClose={() => {
            setContactOpen(false);
            setContactDone(false);
          }}
          onSubmit={() => void sendContactRequest()}
        />
      ) : null}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm font-bold text-primary">
      {label}
      <input
        type="range"
        className="mt-2 w-full accent-[#FF8500]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function MediaMenu({
  anchorRef,
  menuRef,
  onCamera,
  onDevice,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  onCamera: () => void;
  onDevice: () => void;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const gutter = 12;
      const menuWidth = Math.min(288, Math.max(240, window.innerWidth - gutter * 2));
      const estimatedMenuHeight = 132;
      const maxLeft = Math.max(gutter, window.innerWidth - menuWidth - gutter);
      const left = Math.min(
        Math.max(rect.right - menuWidth, gutter),
        maxLeft,
      );
      const belowTop = rect.bottom + 8;
      const top =
        belowTop + estimatedMenuHeight > window.innerHeight - gutter
          ? Math.max(gutter, rect.top - estimatedMenuHeight - 8)
          : belowTop;

      setStyle({
        left,
        position: "fixed",
        top,
        width: menuWidth,
        zIndex: 1000,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  if (typeof document === "undefined") return null;

  const menuStyle: CSSProperties = style ?? {
    left: 0,
    position: "fixed",
    top: 0,
    visibility: "hidden",
    width: 288,
    zIndex: 1000,
  };

  return createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 shadow-2xl"
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-primary hover:bg-surface-container-low"
        onClick={onCamera}
      >
        <span className="material-symbols-outlined">photo_camera</span>
        Scatta foto
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-primary hover:bg-surface-container-low"
        onClick={onDevice}
      >
        <span className="material-symbols-outlined">upload</span>
        Scegli foto da dispositivo
      </button>
    </div>,
    document.body,
  );
}

function InfoPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3">
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-on-surface-variant">{label}</div>
        <div className="truncate font-label-md text-primary">{value}</div>
      </div>
    </div>
  );
}

function ListOrEmpty({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="edit_note"
        title="Sezione vuota"
        body="Queste informazioni compariranno qui appena saranno aggiunte."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-on-surface-variant">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#FF8500]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function EditModal({
  section,
  draft,
  setDraft,
  saving,
  error,
  onCancel,
  onSave,
}: {
  section: EditSection;
  draft: Record<string, string | boolean>;
  setDraft: Dispatch<SetStateAction<Record<string, string | boolean>>>;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  const titleBySection: Record<EditSection, string> = {
    intro: "Informazioni personali/professionali",
    services: "Servizi, professione e sottocategorie",
    contact: "Dati di contatto",
    education: "Studi/Formazione",
    work: "Esperienze lavorative",
    certifications: "Certificazioni",
  };

  function setValue(key: string, value: string | boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[28px] bg-surface-container-lowest p-5 shadow-2xl sm:p-6">
        <h2 className="font-headline-sm text-[24px] text-primary">{titleBySection[section]}</h2>
        <div className="mt-5 space-y-4">
          {section === "intro" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Nome" value={String(draft.first_name ?? "")} onChange={(v) => setValue("first_name", v)} />
                <TextInput label="Cognome" value={String(draft.last_name ?? "")} onChange={(v) => setValue("last_name", v)} />
              </div>
              <TextInput label="Titolo professionale" value={String(draft.headline ?? "")} onChange={(v) => setValue("headline", v)} />
              <ProvinceSelect
                label="Provincia"
                value={String(draft.province_code ?? "")}
                onChange={(value) => setValue("province_code", value)}
              />
              <label className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 text-primary">
                <input
                  type="checkbox"
                  checked={Boolean(draft.available_remote)}
                  onChange={(event) => setValue("available_remote", event.target.checked)}
                />
                Disponibile da remoto
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 text-primary">
                <input
                  type="checkbox"
                  checked={Boolean(draft.available_travel)}
                  onChange={(event) => setValue("available_travel", event.target.checked)}
                />
                Disponibile a trasferte
              </label>
              <TextArea label="Bio" value={String(draft.bio ?? "")} onChange={(v) => setValue("bio", v)} />
            </>
          ) : null}
          {section === "services" ? (
            <>
              <TextArea label="Servizi offerti (uno per riga)" value={String(draft.services_offered ?? "")} onChange={(v) => setValue("services_offered", v)} />
              <TextArea label="Professione / sottocategorie (una per riga)" value={String(draft.specializations ?? "")} onChange={(v) => setValue("specializations", v)} />
            </>
          ) : null}
          {section === "contact" ? (
            <>
              <TextInput label="Telefono" value={String(draft.phone ?? "")} onChange={(v) => setValue("phone", v)} />
              <TextInput label="Email pubblica" value={String(draft.public_email ?? "")} onChange={(v) => setValue("public_email", v)} />
            </>
          ) : null}
          {section === "education" ? (
            <TextArea label="Studi/Formazione (una voce per riga)" value={String(draft.education ?? "")} onChange={(v) => setValue("education", v)} />
          ) : null}
          {section === "work" ? (
            <TextArea label="Esperienze lavorative (una voce per riga)" value={String(draft.work_experiences ?? "")} onChange={(v) => setValue("work_experiences", v)} />
          ) : null}
          {section === "certifications" ? (
            <TextArea label="Certificazioni (una voce per riga)" value={String(draft.certifications ?? "")} onChange={(v) => setValue("certifications", v)} />
          ) : null}
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
            {error}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-full px-5 py-3 font-button text-primary hover:bg-primary-fixed"
            onClick={onCancel}
          >
            Annulla
          </button>
          <button
            type="button"
            className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white hover:bg-[#FF9A2B] disabled:opacity-60"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProvinceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block font-label-md text-primary">
      {label}
      <select
        className="mt-2 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Seleziona provincia</option>
        {ITALIAN_PROVINCES.map((province) => (
          <option key={province.code} value={province.code}>
            {province.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block font-label-md text-primary">
      {label}
      <input
        className="mt-2 w-full rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block font-label-md text-primary">
      {label}
      <textarea
        className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function WorksTab({
  isOwner,
  posts,
  loading,
  postBody,
  setPostBody,
  postFiles,
  setPostFiles,
  posting,
  postError,
  createPost,
  toggleLike,
  updatePost,
  deletePost,
  busyPostId,
  viewerId,
}: {
  isOwner: boolean;
  posts: PostRow[];
  loading: boolean;
  postBody: string;
  setPostBody: (value: string) => void;
  postFiles: File[];
  setPostFiles: (files: File[]) => void;
  posting: boolean;
  postError: string | null;
  createPost: () => void;
  toggleLike: (post: PostRow) => void;
  updatePost: (
    postId: string,
    body: string,
    removedAttachmentIds: string[],
    newFiles: File[],
  ) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  busyPostId: string | null;
  viewerId: string;
}) {
  const [editingPost, setEditingPost] = useState<PostRow | null>(null);
  const [deleteTargetPost, setDeleteTargetPost] = useState<PostRow | null>(null);
  const [mediaViewerAttachment, setMediaViewerAttachment] =
    useState<PostMediaAttachment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDeletePost(postId: string) {
    setDeleteError(null);
    try {
      await deletePost(postId);
      setDeleteTargetPost(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Eliminazione non riuscita.");
    }
  }

  return (
    <div className="space-y-5">
      {isOwner ? (
        <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
          <textarea
            className="min-h-28 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="Racconta un lavoro, un aggiornamento o un consiglio professionale..."
            maxLength={1200}
          />
          {postError ? (
            <div className="mt-3 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
              {postError}
            </div>
          ) : null}
          {postFiles.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
              {postFiles.map((file) => file.name).join(", ")}
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant/30 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="cursor-pointer rounded-full px-4 py-2 font-bold text-secondary hover:bg-surface-container-low">
              <span className="material-symbols-outlined align-middle text-[20px]">image</span>{" "}
              Foto/Video
              <input
                type="file"
                className="sr-only"
                multiple
                accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                onChange={(event) => setPostFiles(Array.from(event.target.files ?? []))}
              />
            </label>
            <button
              type="button"
              disabled={posting}
              className="rounded-full bg-[#FF8500] px-7 py-3 font-button text-white hover:bg-[#FF9A2B] disabled:opacity-60"
              onClick={createPost}
            >
              {posting ? "Pubblicazione…" : "Pubblica"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-headline-sm text-[24px] text-primary">Lavori</h2>
          {loading ? <span className="text-sm text-on-surface-variant">Caricamento…</span> : null}
        </div>
        {posts.length === 0 ? (
          <EmptyState
            icon="work"
            title="Nessun lavoro pubblicato"
            body="Quando saranno pubblicati post o lavori reali, compariranno qui."
          />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-[22px] border border-outline-variant/30 bg-surface-container-low p-4"
              >
                <p className="whitespace-pre-wrap text-on-surface">{post.body}</p>
                <PostAttachmentGrid
                  attachments={post.attachments}
                  onOpen={setMediaViewerAttachment}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-3">
                  <div className="flex gap-4 text-sm text-on-surface-variant">
                    <button
                      type="button"
                      disabled={busyPostId === post.id}
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => void toggleLike(post)}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {post.liked_by_me ? "thumb_up" : "thumb_up_off_alt"}
                      </span>
                      {post.likes_count} Mi piace
                    </button>
                    <span>{post.comments_count} Commenti</span>
                  </div>
                  {post.author_id === viewerId || isOwner ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-full px-3 py-2 text-sm font-bold text-primary hover:bg-primary-fixed"
                        disabled={busyPostId === post.id}
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
                <PostComments postId={post.id} viewerId={viewerId} />
              </article>
            ))}
          </div>
        )}
      </section>

      {deleteTargetPost ? (
        <ConfirmActionModal
          title="Eliminare questo post?"
          body="Questa azione non può essere annullata."
          confirmLabel="Elimina post"
          busy={busyPostId === deleteTargetPost.id}
          error={deleteError}
          onCancel={() => {
            setDeleteTargetPost(null);
            setDeleteError(null);
          }}
          onConfirm={() => void confirmDeletePost(deleteTargetPost.id)}
        />
      ) : null}

      {editingPost ? (
        <PostEditModal
          post={editingPost}
          busy={busyPostId === editingPost.id}
          onCancel={() => setEditingPost(null)}
          onSave={async (body, removedAttachmentIds, newFiles) => {
            await updatePost(editingPost.id, body, removedAttachmentIds, newFiles);
            setEditingPost(null);
          }}
        />
      ) : null}

      <PostMediaViewer
        attachment={mediaViewerAttachment}
        onClose={() => setMediaViewerAttachment(null)}
      />
    </div>
  );
}

function PostComments({ postId, viewerId }: { postId: string; viewerId: string }) {
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
                <div className="min-w-0">
                  <div className="font-label-md text-sm text-primary">
                    {comment.author ? fullName(comment.author) : "Utente"}
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
                  <div className="flex shrink-0 gap-1">
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
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Scrivi un commento..."
        />
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white"
          onClick={() => void addComment()}
        >
          Invia
        </button>
      </div>
      {deleteTargetComment ? (
        <ConfirmActionModal
          title="Eliminare questo commento?"
          body="Questa azione non può essere annullata."
          confirmLabel="Elimina"
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

function ReviewsTab({
  isOwner,
  reviews,
  loading,
  canReview,
  reviewRating,
  setReviewRating,
  reviewBody,
  setReviewBody,
  submitting,
  error,
  submitReview,
  replyDrafts,
  setReplyDrafts,
  replyToReview,
}: {
  isOwner: boolean;
  reviews: ReviewRow[];
  loading: boolean;
  canReview: boolean;
  reviewRating: number;
  setReviewRating: (value: number) => void;
  reviewBody: string;
  setReviewBody: (value: string) => void;
  submitting: boolean;
  error: string | null;
  submitReview: () => void;
  replyDrafts: Record<string, string>;
  setReplyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  replyToReview: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      {canReview ? (
        <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
          <h2 className="font-headline-sm text-[24px] text-primary">Lascia una recensione</h2>
          <div className="mt-4 flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={star <= reviewRating ? "text-[#FF8500]" : "text-outline"}
                onClick={() => setReviewRating(star)}
              >
                <span className="material-symbols-outlined">star</span>
              </button>
            ))}
          </div>
          <textarea
            className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={reviewBody}
            onChange={(event) => setReviewBody(event.target.value)}
            placeholder="Commento opzionale..."
          />
          {error ? (
            <div className="mt-3 rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
              {error}
            </div>
          ) : null}
          <button
            type="button"
            disabled={submitting}
            className="mt-4 rounded-full bg-[#FF8500] px-6 py-3 font-button text-white hover:bg-[#FF9A2B] disabled:opacity-60"
            onClick={submitReview}
          >
            {submitting ? "Invio…" : "Pubblica recensione"}
          </button>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-headline-sm text-[24px] text-primary">Recensioni</h2>
          {loading ? <span className="text-sm text-on-surface-variant">Caricamento…</span> : null}
        </div>
        {reviews.length === 0 ? (
          <EmptyState
            icon="rate_review"
            title="Nessuna recensione"
            body="Le recensioni reali dei clienti compariranno qui."
          />
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-[22px] border border-outline-variant/30 bg-surface-container-low p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-label-md text-primary">
                      {review.author
                        ? fullName(review.author)
                        : "Cliente"}
                    </h3>
                    <div className="mt-1 flex text-[#FF8500]">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span key={index} className="material-symbols-outlined text-[18px]">
                          {index < review.rating ? "star" : "star_outline"}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    {formatDate(review.created_at)}
                  </span>
                </div>
                {review.body ? (
                  <p className="mt-3 whitespace-pre-wrap text-on-surface-variant">
                    {review.body}
                  </p>
                ) : null}
                {review.professional_reply ? (
                  <div className="mt-4 rounded-2xl bg-primary-fixed p-4 text-on-primary-fixed">
                    <div className="text-sm font-bold">Risposta del professionista</div>
                    <p className="mt-1">{review.professional_reply}</p>
                  </div>
                ) : isOwner ? (
                  <div className="mt-4">
                    <textarea
                      className="min-h-20 w-full resize-none rounded-2xl border border-outline-variant px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={replyDrafts[review.id] ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [review.id]: event.target.value,
                        }))
                      }
                      placeholder="Rispondi una sola volta a questa recensione..."
                    />
                    <button
                      type="button"
                      className="mt-2 rounded-full bg-primary px-5 py-2.5 font-button text-white"
                      onClick={() => replyToReview(review.id)}
                    >
                      Rispondi
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ContactModal({
  profile,
  subject,
  setSubject,
  message,
  setMessage,
  files,
  setFiles,
  privacy,
  setPrivacy,
  sending,
  done,
  error,
  onClose,
  onSubmit,
}: {
  profile: ProfessionalProfileDetails;
  subject: string;
  setSubject: (value: string) => void;
  message: string;
  setMessage: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  privacy: boolean;
  setPrivacy: (value: boolean) => void;
  sending: boolean;
  done: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-inverse-surface/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-[28px] bg-surface-container-lowest shadow-2xl">
        <div className="border-b border-outline-variant/30 p-5 sm:p-6">
          <h2 className="font-headline-sm text-[24px] text-primary">
            Invia una richiesta a {fullName(profile)}
          </h2>
          <p className="mt-1 text-on-surface-variant">
            La richiesta aprirà una conversazione reale con il professionista.
          </p>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {done ? (
            <div className="rounded-2xl bg-primary-fixed p-5 text-on-primary-fixed">
              <div className="font-bold">Richiesta inviata</div>
              <p className="mt-1">Il professionista riceverà la notifica e potrà accettare o rifiutare.</p>
            </div>
          ) : (
            <>
              <TextInput label="Oggetto" value={subject} onChange={setSubject} />
              <TextArea label="Messaggio" value={message} onChange={setMessage} />
              <label className="block font-label-md text-primary">
                Foto, video o documenti
                <input
                  type="file"
                  multiple
                  className="mt-2 w-full rounded-2xl border border-outline-variant px-4 py-3"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              {files.length > 0 ? (
                <p className="text-sm text-on-surface-variant">
                  {files.length} file selezionati
                </p>
              ) : null}
              <label className="flex items-start gap-3 rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={privacy}
                  onChange={(event) => setPrivacy(event.target.checked)}
                />
                Accetto il trattamento dei dati per la gestione della richiesta.
              </label>
              {error ? (
                <div className="rounded-2xl bg-error-container p-3 text-sm text-on-error-container">
                  {error}
                </div>
              ) : null}
            </>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-full px-5 py-3 font-button text-primary hover:bg-primary-fixed"
              onClick={onClose}
            >
              {done ? "Chiudi" : "Annulla"}
            </button>
            {!done ? (
              <button
                type="button"
                className="rounded-full bg-[#FF8500] px-6 py-3 font-button text-white hover:bg-[#FF9A2B] disabled:opacity-60"
                disabled={sending}
                onClick={onSubmit}
              >
                {sending ? "Invio…" : "Invia richiesta"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

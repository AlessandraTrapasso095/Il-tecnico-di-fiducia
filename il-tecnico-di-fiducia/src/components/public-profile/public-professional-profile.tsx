"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { OwnerEditableAvatar } from "@/components/public-profile/owner-editable-avatar";
import { OwnerProfileEditModal } from "@/components/public-profile/owner-profile-edit-modal";
import {
  OwnerNewWorkButton,
  OwnerPostActions,
} from "@/components/public-profile/owner-work-controls";
import { PostComments } from "@/components/posts/post-comments";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";
import type { PublicProfessionalProfileDetails } from "@/lib/server/professional-profile";

type TabId = "profile" | "works" | "reviews";

export type ProfessionalProfileViewerContext = {
  id: string;
  role: "customer" | "professional" | "admin";
  isOwner: boolean;
  canViewContacts: boolean;
  isFollowing: boolean | null;
  contactStatus: "pending" | "accepted" | "rejected" | null;
  contacts: {
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
  } | null;
};

function fullName(profile: PublicProfessionalProfileDetails) {
  return (
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    "Professionista"
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function splitPostBody(body: string) {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");

  const rawTitle = lines.shift()?.trim() ?? "";

  const title = rawTitle.replace(/^\[[A-Z0-9-]+\]\s*/i, "").trim();

  const content = lines.join("\n").trim();

  return {
    title: title || normalized,
    content: title === normalized ? "" : content,
  };
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="font-headline-sm text-[25px] text-primary sm:text-[28px]">
        {title}
      </h2>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl bg-surface-container-low px-4 py-3 leading-6 text-on-surface-variant"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export function PublicProfessionalProfile({
  profile,
  viewerContext = null,
  initialTab = "profile",
}: {
  profile: PublicProfessionalProfileDetails;
  viewerContext?: ProfessionalProfileViewerContext | null;
  initialTab?: "profile" | "works" | "reviews";
}) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [isFollowing, setIsFollowing] = useState(
    viewerContext?.isFollowing ?? false,
  );
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const [ownerEditOpen, setOwnerEditOpen] = useState(false);

  const [postSocialState, setPostSocialState] = useState<
    Record<
      string,
      {
        likes_count: number;
        comments_count: number;
        liked_by_me: boolean;
      }
    >
  >(() =>
    Object.fromEntries(
      profile.work_posts.map((post) => [
        post.id,
        {
          likes_count: 0,
          comments_count: 0,
          liked_by_me: false,
        },
      ]),
    ),
  );

  const [expandedComments, setExpandedComments] = useState<
    Record<string, boolean>
  >({});

  const [busyLikePostId, setBusyLikePostId] = useState<string | null>(null);

  const [socialPostErrors, setSocialPostErrors] = useState<
    Record<string, string | null>
  >({});
  const worksCarouselRef = useRef<HTMLDivElement | null>(null);

  const provinceName =
    ITALIAN_PROVINCES_BY_NAME.find(
      (province) => province.code === profile.province_code,
    )?.name ?? profile.province_code;

  const professionLabel =
    profile.subcategory?.name ??
    profile.categories.map((category) => category.name).join(" · ") ??
    profile.headline;

  const profilePath = `/professionisti/${profile.id}`;
  const contactPath = `${profilePath}?action=contact`;
  const contactLoginPath = `/auth/login?next=${encodeURIComponent(contactPath)}`;

  async function toggleFollow() {
    if (
      !viewerContext ||
      viewerContext.role !== "professional" ||
      viewerContext.isOwner ||
      followBusy
    ) {
      return;
    }

    setFollowBusy(true);
    setFollowError(null);

    try {
      const response = isFollowing
        ? await fetch(`/api/follows/${profile.id}`, {
            method: "DELETE",
          })
        : await fetch("/api/follows", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              followed_id: profile.id,
            }),
          });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(payload?.error || "Impossibile aggiornare il follow.");
      }

      setIsFollowing((current) => !current);
    } catch (error) {
      setFollowError(
        error instanceof Error
          ? error.message
          : "Impossibile aggiornare il follow.",
      );
    } finally {
      setFollowBusy(false);
    }
  }

  async function togglePostLike(postId: string) {
    if (viewerContext?.role !== "professional" || busyLikePostId !== null) {
      return;
    }

    const current = postSocialState[postId] ?? {
      likes_count: 0,
      comments_count: 0,
      liked_by_me: false,
    };

    setBusyLikePostId(postId);

    setSocialPostErrors((errors) => ({
      ...errors,
      [postId]: null,
    }));

    try {
      const response = await fetch(`/api/posts/${postId}/likes`, {
        method: current.liked_by_me ? "DELETE" : "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          payload?.error ?? "Non è stato possibile aggiornare il Mi piace.",
        );
      }

      setPostSocialState((state) => ({
        ...state,
        [postId]: {
          ...current,
          liked_by_me: !current.liked_by_me,
          likes_count: Math.max(
            0,
            current.likes_count + (current.liked_by_me ? -1 : 1),
          ),
        },
      }));
    } catch (error) {
      setSocialPostErrors((errors) => ({
        ...errors,
        [postId]:
          error instanceof Error
            ? error.message
            : "Non è stato possibile aggiornare il Mi piace.",
      }));
    } finally {
      setBusyLikePostId(null);
    }
  }

  function scrollWorksCarousel(direction: -1 | 1) {
    const carousel = worksCarouselRef.current;
    if (!carousel) return;

    const firstCard = carousel.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 320;
    const gap = 12;

    carousel.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: "smooth",
    });
  }

  function openWorkPost(postId: string) {
    setTab("works");

    window.setTimeout(() => {
      document.getElementById(`public-work-post-${postId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  useEffect(() => {
    if (viewerContext?.role !== "professional") {
      return;
    }

    let cancelled = false;

    async function loadSocialPostState() {
      const merged: Record<
        string,
        {
          likes_count: number;
          comments_count: number;
          liked_by_me: boolean;
        }
      > = {};

      let page = 1;
      const pageSize = 50;

      try {
        while (!cancelled) {
          const response = await fetch(
            `/api/posts?author_id=${encodeURIComponent(
              profile.id,
            )}&page=${page}&page_size=${pageSize}`,
            {
              method: "GET",
            },
          );

          if (!response.ok) {
            throw new Error("Non è stato possibile caricare le interazioni.");
          }

          const payload = (await response.json()) as {
            posts?: {
              id: string;
              likes_count: number;
              comments_count: number;
              liked_by_me: boolean;
            }[];
          };

          const posts = payload.posts ?? [];

          for (const post of posts) {
            merged[post.id] = {
              likes_count: post.likes_count ?? 0,
              comments_count: post.comments_count ?? 0,
              liked_by_me: post.liked_by_me ?? false,
            };
          }

          if (posts.length < pageSize) {
            break;
          }

          page += 1;
        }

        if (!cancelled) {
          setPostSocialState((state) => ({
            ...state,
            ...merged,
          }));
        }
      } catch {
        /*
         * Il profilo resta perfettamente utilizzabile
         * anche se il refresh dei metadati social fallisce.
         */
      }
    }

    void loadSocialPostState();

    return () => {
      cancelled = true;
    };
  }, [profile.id, viewerContext?.role]);

  useEffect(() => {
    if (carouselPaused || profile.work_media.length <= 1) {
      return;
    }

    const carouselElement = worksCarouselRef.current;
    if (!carouselElement) return;

    const activeCarousel: HTMLDivElement = carouselElement;

    let animationFrame = 0;
    let previousTime: number | null = null;

    // Manteniamo una posizione decimale separata:
    // scrollLeft del browser può arrotondare gli spostamenti subpixel.
    let scrollPosition = activeCarousel.scrollLeft;

    const pixelsPerSecond = 26;

    function animate(time: number) {
      if (previousTime === null) {
        previousTime = time;
      }

      const elapsed = Math.min(time - previousTime, 64);

      previousTime = time;

      const loopWidth = activeCarousel.scrollWidth / 2;

      if (loopWidth > 1) {
        scrollPosition += (pixelsPerSecond * elapsed) / 1000;

        while (scrollPosition >= loopWidth) {
          scrollPosition -= loopWidth;
        }

        activeCarousel.scrollLeft = Math.floor(scrollPosition);
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [carouselPaused, profile.work_media.length]);

  return (
    <main className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-5 lg:px-10 xl:px-14">
        <Link
          href="/cerca"
          className="inline-flex items-center gap-1 py-2 text-sm font-bold text-primary transition hover:opacity-70"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Torna alla ricerca
        </Link>

        <section className="mt-4 border-b border-outline-variant/30 pb-7 sm:mt-5 sm:pb-8 lg:pb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between lg:gap-10">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:gap-6 lg:gap-8">
              <OwnerEditableAvatar
                profile={profile}
                isOwner={viewerContext?.isOwner === true}
              />

              <div className="min-w-0">
                <div className="font-label-md text-xs font-bold uppercase tracking-[0.14em] text-[#FF8500] sm:text-sm">
                  {professionLabel || "Professionista"}
                </div>

                <h1 className="mt-2 font-headline-lg text-[32px] leading-[1.08] text-primary sm:text-[40px] lg:text-[46px]">
                  {fullName(profile)}
                </h1>

                {profile.headline && profile.headline !== professionLabel ? (
                  <p className="mt-2 max-w-3xl text-base leading-7 text-on-surface-variant sm:text-lg">
                    {profile.headline}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
                  {provinceName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 text-sm font-bold text-primary">
                      <span className="material-symbols-outlined text-[18px]">
                        location_on
                      </span>
                      {provinceName}
                    </span>
                  ) : null}

                  {profile.available_remote ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-sm font-bold text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[18px]">
                        language
                      </span>
                      Remoto
                    </span>
                  ) : null}

                  {profile.available_travel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1.5 text-sm font-bold text-on-secondary-fixed">
                      <span className="material-symbols-outlined text-[18px]">
                        commute
                      </span>
                      Trasferte
                    </span>
                  ) : null}

                  {profile.is_ctu ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-sm font-bold text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[18px]">
                        verified
                      </span>
                      CTU
                    </span>
                  ) : null}

                  {profile.is_ctp ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-sm font-bold text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[18px]">
                        verified
                      </span>
                      CTP
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="inline-flex items-center gap-2">
                    <span
                      className="text-[21px] leading-none text-[#FF8500]"
                      aria-hidden
                    >
                      ★
                    </span>
                    <span className="font-bold text-primary">
                      {profile.rating_average !== null
                        ? profile.rating_average.toFixed(1)
                        : "—"}
                    </span>
                    <span className="text-sm text-on-surface-variant">
                      {profile.reviews_count}{" "}
                      {profile.reviews_count === 1
                        ? "recensione"
                        : "recensioni"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 md:items-end md:pt-1">
              {viewerContext?.isOwner ? (
                <button
                  type="button"
                  aria-label="Modifica il tuo profilo"
                  onClick={() => setOwnerEditOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-6 py-3 font-button text-button text-white transition-colors hover:bg-[#FF9A2B]"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    edit
                  </span>
                  Modifica profilo
                </button>
              ) : null}
              {!viewerContext ? (
                <Link
                  href={contactLoginPath}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-6 py-3 font-button text-button text-white transition-colors hover:bg-[#FF9A2B]"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    chat
                  </span>
                  Contatta
                </Link>
              ) : null}

              {viewerContext?.role === "customer" ? (
                <Link
                  href={contactPath}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-6 py-3 font-button text-button text-white transition-colors hover:bg-[#FF9A2B]"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    chat
                  </span>
                  Contatta
                </Link>
              ) : null}

              {viewerContext?.role === "professional" &&
              !viewerContext.isOwner ? (
                <button
                  type="button"
                  onClick={() => void toggleFollow()}
                  disabled={followBusy}
                  className={[
                    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 font-button text-button transition disabled:opacity-60",
                    isFollowing
                      ? "border border-primary bg-transparent text-primary hover:bg-primary-fixed"
                      : "bg-[#FF8500] text-white hover:bg-[#FF9A2B]",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isFollowing ? "person_check" : "person_add"}
                  </span>

                  {followBusy
                    ? "Aggiornamento…"
                    : isFollowing
                      ? "Non seguire più"
                      : "Segui"}
                </button>
              ) : null}

              {followError ? (
                <p className="max-w-[260px] text-sm text-error">
                  {followError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {profile.work_media.length > 0 ? (
          <section
            className="group relative border-b border-outline-variant/30 py-7 sm:py-8 lg:py-10"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
          >
            <div
              ref={worksCarouselRef}
              className="flex gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[...profile.work_media, ...profile.work_media].map(
                (media, index) => (
                  <button
                    key={`${media.id}-${index}`}
                    type="button"
                    onClick={() => openWorkPost(media.post_id)}
                    className="relative aspect-[4/3] w-[82%] shrink-0 overflow-hidden rounded-xl bg-surface-container-low text-left sm:w-[48%] md:w-[32%] lg:w-[24%]"
                    aria-label="Apri il lavoro collegato"
                  >
                    {media.media_type === "image" ? (
                      <Image
                        src={media.public_url}
                        alt={media.file_name ?? "Lavoro del professionista"}
                        fill
                        sizes="(max-width: 639px) 82vw, (max-width: 767px) 48vw, (max-width: 1023px) 32vw, 24vw"
                        unoptimized
                        className="object-cover transition duration-300 hover:scale-[1.02]"
                      />
                    ) : (
                      <>
                        <video
                          src={media.public_url}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-full w-full bg-black object-cover"
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg">
                            <span className="material-symbols-outlined text-[28px]">
                              play_arrow
                            </span>
                          </span>
                        </span>
                      </>
                    )}

                    <span className="pointer-events-none absolute inset-0 bg-primary/0 transition hover:bg-primary/5" />
                  </button>
                ),
              )}
            </div>

            {profile.work_media.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => scrollWorksCarousel(-1)}
                  aria-label="Lavori precedenti"
                  className="absolute left-3 top-1/2 z-30 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow-xl transition-all duration-200 hover:scale-105 md:flex md:group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined">
                    chevron_left
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => scrollWorksCarousel(1)}
                  aria-label="Lavori successivi"
                  className="absolute right-3 top-1/2 z-30 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white opacity-0 shadow-xl transition-all duration-200 hover:scale-105 md:flex md:group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined">
                    chevron_right
                  </span>
                </button>
              </>
            ) : null}
          </section>
        ) : null}

        <nav
          aria-label="Sezioni profilo"
          className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-outline-variant/30 bg-surface/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
        >
          <div className="flex min-w-max gap-8">
            {[
              ["profile", "Profilo"],
              ["works", "Lavori"],
              ["reviews", "Recensioni"],
            ].map(([value, label]) => {
              const active = tab === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value as TabId)}
                  className={[
                    "relative py-5 text-sm font-bold transition sm:text-base",
                    active
                      ? "text-primary"
                      : "text-on-surface-variant hover:text-primary",
                  ].join(" ")}
                >
                  {label}

                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[#FF8500]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        <section className="grid gap-10 py-8 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] md:gap-x-12 lg:gap-x-16 lg:py-10">
          <div className="min-w-0">
            {tab === "profile" ? (
              <div className="space-y-10">
                {profile.bio ? (
                  <section>
                    <h2 className="font-headline-sm text-[27px] text-primary sm:text-[30px]">
                      Profilo
                    </h2>

                    <p className="mt-4 whitespace-pre-line text-[15px] leading-7 text-on-surface-variant sm:text-base">
                      {profile.bio}
                    </p>
                  </section>
                ) : null}

                <ListSection
                  title="Studi e formazione"
                  items={profile.education}
                />

                <ListSection
                  title="Esperienze lavorative"
                  items={profile.work_experiences}
                />

                <ListSection
                  title="Certificazioni"
                  items={profile.certifications}
                />
              </div>
            ) : null}

            {tab === "works" ? (
              <div>
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-headline-sm text-[28px] text-primary sm:text-[31px]">
                      Lavori
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Progetti, aggiornamenti e contenuti pubblicati dal
                      professionista.
                    </p>
                  </div>

                  {viewerContext?.isOwner ? <OwnerNewWorkButton /> : null}
                </div>

                {profile.work_posts.length > 0 ? (
                  <div className="space-y-6">
                    {profile.work_posts.map((post) => (
                      <article
                        key={post.id}
                        id={`public-work-post-${post.id}`}
                        className="scroll-mt-24 border-b border-outline-variant/30 pb-7"
                      >
                        {(() => {
                          const postContent = splitPostBody(post.body);

                          return (
                            <>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-col gap-1">
                                  <h3 className="text-lg font-bold leading-6 text-primary sm:text-xl">
                                    {postContent.title}
                                  </h3>

                                  <time
                                    dateTime={post.created_at}
                                    className="text-sm font-bold text-on-surface-variant"
                                  >
                                    {formatDate(post.created_at)}
                                  </time>
                                </div>

                                {viewerContext?.isOwner ? (
                                  <OwnerPostActions
                                    post={{
                                      id: post.id,
                                      body: post.body,
                                      attachments: post.attachments,
                                    }}
                                  />
                                ) : null}
                              </div>

                              {postContent.content ? (
                                <p className="mt-4 whitespace-pre-wrap font-normal leading-7 text-on-surface">
                                  {postContent.content}
                                </p>
                              ) : null}
                            </>
                          );
                        })()}

                        {post.attachments.length > 0 ? (
                          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-2">
                            {post.attachments.map((media) => (
                              <div
                                key={media.id}
                                className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-container-low"
                              >
                                {media.media_type === "image" ? (
                                  <Image
                                    src={media.public_url}
                                    alt={
                                      media.file_name ??
                                      "Lavoro del professionista"
                                    }
                                    fill
                                    sizes="(max-width: 639px) 100vw, 50vw"
                                    unoptimized
                                    className="object-cover"
                                  />
                                ) : (
                                  <video
                                    src={media.public_url}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full bg-black object-cover"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {viewerContext?.role === "professional" ? (
                          <div className="mt-5 border-t border-outline-variant/20 pt-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                disabled={busyLikePostId === post.id}
                                onClick={() => void togglePostLike(post.id)}
                                className={[
                                  "inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-60",
                                  postSocialState[post.id]?.liked_by_me
                                    ? "bg-primary-fixed text-primary"
                                    : "bg-surface-container-low text-on-surface-variant hover:bg-primary-fixed hover:text-primary",
                                ].join(" ")}
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  thumb_up
                                </span>
                                Mi piace ·{" "}
                                {postSocialState[post.id]?.likes_count ?? 0}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedComments((current) => ({
                                    ...current,
                                    [post.id]: !current[post.id],
                                  }))
                                }
                                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface-variant transition hover:bg-primary-fixed hover:text-primary"
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  chat_bubble
                                </span>
                                Commenti ·{" "}
                                {postSocialState[post.id]?.comments_count ?? 0}
                              </button>
                            </div>

                            {socialPostErrors[post.id] ? (
                              <p className="mt-3 text-sm text-error">
                                {socialPostErrors[post.id]}
                              </p>
                            ) : null}

                            {expandedComments[post.id] ? (
                              <div className="mt-4">
                                <PostComments
                                  postId={post.id}
                                  viewerId={viewerContext.id}
                                  onCountChange={(delta) =>
                                    setPostSocialState((state) => {
                                      const current = state[post.id] ?? {
                                        likes_count: 0,
                                        comments_count: 0,
                                        liked_by_me: false,
                                      };

                                      return {
                                        ...state,
                                        [post.id]: {
                                          ...current,
                                          comments_count: Math.max(
                                            0,
                                            current.comments_count + delta,
                                          ),
                                        },
                                      };
                                    })
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-on-surface-variant">
                    Nessun lavoro pubblicato.
                  </p>
                )}
              </div>
            ) : null}

            {tab === "reviews" ? (
              <div>
                <div className="mb-7">
                  <h2 className="font-headline-sm text-[28px] text-primary sm:text-[31px]">
                    Recensioni
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Feedback ricevuti dai clienti.
                  </p>
                </div>

                {profile.reviews.length > 0 ? (
                  <div className="space-y-6">
                    {profile.reviews.map((review) => (
                      <article
                        key={review.id}
                        className="border-b border-outline-variant/30 pb-7"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-primary">
                              Cliente
                            </div>

                            <div className="mt-1 flex text-[#FF8500]">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <span
                                  key={index}
                                  className="material-symbols-outlined text-[19px]"
                                >
                                  {index < review.rating
                                    ? "star"
                                    : "star_outline"}
                                </span>
                              ))}
                            </div>
                          </div>

                          <span className="text-xs text-on-surface-variant">
                            {formatDate(review.created_at)}
                          </span>
                        </div>

                        {review.title ? (
                          <h3 className="mt-4 font-bold text-primary">
                            {review.title}
                          </h3>
                        ) : null}

                        {review.body ? (
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-on-surface-variant">
                            {review.body}
                          </p>
                        ) : null}

                        {review.professional_reply ? (
                          <div className="mt-5 rounded-2xl bg-primary-fixed p-4 text-on-primary-fixed-variant sm:p-5">
                            <div className="text-sm font-bold">
                              Risposta del professionista
                            </div>
                            <p className="mt-2 leading-6">
                              {review.professional_reply}
                            </p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-on-surface-variant">
                    Nessuna recensione ricevuta.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <aside className="space-y-9 md:border-l md:border-outline-variant/30 md:pl-8 lg:pl-10">
            <button
              type="button"
              onClick={() => setTab("reviews")}
              className="block w-full rounded-[22px] bg-surface-container-low p-5 text-left transition hover:bg-surface-container"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-headline-sm text-[24px] text-primary">
                    Recensioni
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-[30px] font-bold leading-none text-[#FF8500]">
                      {profile.rating_average !== null
                        ? profile.rating_average.toFixed(1)
                        : "—"}
                    </span>

                    <span className="pb-0.5 text-sm text-on-surface-variant">
                      {profile.reviews_count}{" "}
                      {profile.reviews_count === 1
                        ? "recensione"
                        : "recensioni"}
                    </span>
                  </div>
                </div>

                <span className="material-symbols-outlined text-primary">
                  arrow_forward
                </span>
              </div>
            </button>

            <section>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-primary">
                  {viewerContext?.canViewContacts ? "contact_mail" : "lock"}
                </span>

                <h2 className="font-headline-sm text-[24px] text-primary">
                  Dati di contatto
                </h2>
              </div>

              {viewerContext?.canViewContacts && viewerContext.contacts ? (
                <div
                  className="mt-4 space-y-3"
                  aria-label="Dati di contatto visibili"
                >
                  {[
                    ["phone", "Telefono", viewerContext.contacts.phone],
                    ["mail", "Email", viewerContext.contacts.email],
                    ["language", "Sito web", viewerContext.contacts.websiteUrl],
                  ].map(([icon, label, value]) => (
                    <div
                      key={label}
                      className="flex items-start gap-3 rounded-2xl bg-surface-container-low px-4 py-3"
                    >
                      <span className="material-symbols-outlined shrink-0 text-[20px] text-primary">
                        {icon}
                      </span>

                      <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
                          {label}
                        </div>

                        <div className="mt-1 break-all text-sm font-bold text-primary">
                          {value || "Non indicato"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div
                    className="mt-4 space-y-3"
                    aria-label="Dati di contatto oscurati"
                  >
                    {[
                      ["phone", "Telefono"],
                      ["mail", "Email"],
                      ["language", "Sito web"],
                    ].map(([icon, label]) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3"
                      >
                        <span className="material-symbols-outlined shrink-0 text-[20px] text-primary">
                          {icon}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">
                            {label}
                          </div>

                          <div className="mt-1 select-none tracking-[0.14em] text-on-surface-variant blur-[3px]">
                            ••••••••••••••••
                          </div>
                        </div>

                        <span className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant">
                          lock
                        </span>
                      </div>
                    ))}
                  </div>

                  {viewerContext?.role !== "professional" ? (
                    <>
                      <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                        I dati di contatto vengono mostrati solo dopo una
                        richiesta accettata dal professionista.
                      </p>

                      {!viewerContext ? (
                        <Link
                          href={contactLoginPath}
                          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-primary-fixed"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            chat
                          </span>
                          Contatta per richiedere l&apos;accesso
                        </Link>
                      ) : null}

                      {viewerContext?.role === "customer" ? (
                        <Link
                          href={contactPath}
                          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-primary px-5 py-2.5 text-sm font-bold text-primary transition hover:bg-primary-fixed"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            chat
                          </span>
                          Contatta per richiedere l&apos;accesso
                        </Link>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </section>

            {profile.specializations.length > 0 ? (
              <section>
                <h2 className="font-headline-sm text-[24px] text-primary">
                  Specializzazioni
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.specializations.map((specialization) => (
                    <span
                      key={specialization}
                      className="rounded-full border border-outline-variant/40 px-4 py-2 text-sm text-on-surface-variant"
                    >
                      {specialization}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {profile.services_offered.length > 0 ? (
              <section>
                <h2 className="font-headline-sm text-[24px] text-primary">
                  Servizi offerti
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.services_offered.map((service) => (
                    <span
                      key={service}
                      className="rounded-full bg-surface-container-low px-4 py-2 text-sm font-bold text-primary"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {profile.is_ctu || profile.is_ctp ? (
              <section>
                <h2 className="font-headline-sm text-[24px] text-primary">
                  Qualifiche
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.is_ctu ? (
                    <span className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-bold text-on-primary-fixed-variant">
                      CTU
                    </span>
                  ) : null}

                  {profile.is_ctp ? (
                    <span className="rounded-full bg-primary-fixed px-4 py-2 text-sm font-bold text-on-primary-fixed-variant">
                      CTP
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </div>
      {viewerContext?.isOwner && ownerEditOpen ? (
        <OwnerProfileEditModal
          profile={profile}
          contacts={viewerContext.contacts}
          onClose={() => setOwnerEditOpen(false)}
        />
      ) : null}
    </main>
  );
}

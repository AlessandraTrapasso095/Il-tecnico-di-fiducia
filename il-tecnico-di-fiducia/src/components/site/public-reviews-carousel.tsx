"use client";

import Image from "next/image";
import { useRef } from "react";

type PublicHomepageReview = {
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  customer: {
    display_name: string;
    initials: string;
    avatar_url: string | null;
  };
  professional: {
    display_name: string;
    headline: string | null;
    avatar_url: string | null;
  };
};

type PublicReviewsCarouselProps = {
  reviews: PublicHomepageReview[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function Stars({ rating }: { rating: number }) {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div
      aria-label={`${normalizedRating} stelle su 5`}
      className="flex items-center gap-0.5"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`material-symbols-outlined text-[19px] ${
            index < normalizedRating ? "text-[#FF8500]" : "text-outline-variant"
          }`}
          aria-hidden
        >
          {index < normalizedRating ? "star" : "star_outline"}
        </span>
      ))}
    </div>
  );
}

export function PublicReviewsCarousel({ reviews }: PublicReviewsCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const hasReviews = reviews.length > 0;

  function scrollReviews(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction * Math.min(track.clientWidth * 0.86, 440),
      behavior: "smooth",
    });
  }

  return (
    <div className="rounded-[32px] border border-outline-variant/30 bg-surface-container-low p-5 shadow-sm sm:rounded-[40px] sm:p-8 lg:p-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#FF8500]/10 px-4 py-2 text-sm font-semibold text-[#FF8500]">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              verified
            </span>
            Esperienze reali
          </div>
          <h2 className="font-headline-md text-headline-md text-primary">
            Le recensioni degli utenti
          </h2>
          <p className="mt-3 max-w-[680px] font-body-md text-body-md text-on-surface-variant">
            Storie autentiche di clienti che hanno trovato il professionista giusto.
          </p>
        </div>

        {reviews.length > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollReviews(-1)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-outline-variant bg-white text-primary shadow-sm transition hover:border-primary hover:bg-primary/5"
              aria-label="Mostra recensioni precedenti"
            >
              <span className="material-symbols-outlined" aria-hidden>
                chevron_left
              </span>
            </button>
            <button
              type="button"
              onClick={() => scrollReviews(1)}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-outline-variant bg-white text-primary shadow-sm transition hover:border-primary hover:bg-primary/5"
              aria-label="Mostra recensioni successive"
            >
              <span className="material-symbols-outlined" aria-hidden>
                chevron_right
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {!hasReviews ? (
        <div className="mt-8 rounded-[28px] border border-dashed border-outline-variant bg-white/70 px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-surface-container-high text-outline">
            <span className="material-symbols-outlined" aria-hidden>
              rate_review
            </span>
          </div>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Le prime recensioni dei nostri utenti arriveranno presto.
          </p>
        </div>
      ) : (
        <div
          ref={trackRef}
          className="-mx-2 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-2 pb-3"
          aria-label="Carousel recensioni degli utenti"
        >
          {reviews.map((review, index) => (
            <article
              key={`${review.created_at}-${index}`}
              className="flex min-h-[310px] w-[min(84vw,390px)] shrink-0 snap-start flex-col rounded-[28px] border border-outline-variant/40 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-primary text-white">
                  {review.customer.avatar_url ? (
                    <Image
                      src={review.customer.avatar_url}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-label-md text-label-md">
                      {review.customer.initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-label-lg text-label-lg text-primary">
                    {review.customer.display_name}
                  </div>
                  <div className="mt-1 text-sm text-on-surface-variant">
                    {formatDate(review.created_at)}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Stars rating={review.rating} />
              </div>

              {review.title ? (
                <h3 className="mt-4 line-clamp-2 font-headline-sm text-headline-sm text-primary">
                  {review.title}
                </h3>
              ) : null}

              <p className="mt-3 line-clamp-5 whitespace-pre-wrap font-body-md text-body-md text-on-surface-variant">
                “{review.body}”
              </p>

              <div className="mt-auto border-t border-outline-variant/40 pt-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-outline">
                  Recensione per
                </div>
                <div className="mt-1 font-label-lg text-label-lg text-primary">
                  {review.professional.display_name}
                </div>
                {review.professional.headline ? (
                  <div className="mt-1 line-clamp-1 text-sm text-on-surface-variant">
                    {review.professional.headline}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

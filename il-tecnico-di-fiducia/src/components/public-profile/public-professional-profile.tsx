import Link from "next/link";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";
import type { PublicProfessionalProfileDetails } from "@/lib/server/professional-profile";

function fullName(profile: PublicProfessionalProfileDetails) {
  return (
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
    "Professionista"
  );
}

export function PublicProfessionalProfile({
  profile,
}: {
  profile: PublicProfessionalProfileDetails;
}) {
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

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/cerca"
        className="mb-6 inline-flex text-sm font-bold text-primary hover:underline"
      >
        ← Torna alla ricerca
      </Link>

      <section className="overflow-hidden rounded-[32px] border border-outline-variant/30 bg-surface-container-lowest shadow-[0_12px_40px_rgba(8,43,95,0.09)]">
        <div className="bg-primary px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <ProfileAvatar
              person={profile}
              alt={fullName(profile)}
              size="xl"
              className="border-4 border-white bg-surface-container-high text-primary"
              fallbackClassName="font-button"
            />

            <div className="min-w-0">
              <h1 className="font-headline-md text-[30px] leading-tight text-white sm:text-[38px]">
                {fullName(profile)}
              </h1>

              <div className="mt-2 text-lg text-primary-fixed">
                {professionLabel || "Professionista"}
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {provinceName ? (
                  <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-bold text-white">
                    {provinceName}
                  </span>
                ) : null}

                {profile.available_remote ? (
                  <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-bold text-white">
                    Remoto
                  </span>
                ) : null}

                {profile.available_travel ? (
                  <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-bold text-white">
                    Trasferte
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            {profile.bio ? (
              <section>
                <h2 className="font-headline-sm text-headline-sm text-primary">
                  Profilo
                </h2>
                <p className="mt-3 whitespace-pre-line leading-7 text-on-surface-variant">
                  {profile.bio}
                </p>
              </section>
            ) : null}

            {profile.is_ctu || profile.is_ctp ? (
              <section>
                <h2 className="font-headline-sm text-headline-sm text-primary">
                  Qualifiche professionali
                </h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.is_ctu ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-xs font-bold text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[16px]">
                        verified
                      </span>
                      CTU
                    </span>
                  ) : null}

                  {profile.is_ctp ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-xs font-bold text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[16px]">
                        verified
                      </span>
                      CTP
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}

            {profile.services_offered.length > 0 ? (
              <section>
                <h2 className="font-headline-sm text-headline-sm text-primary">
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

            {profile.specializations.length > 0 ? (
              <section>
                <h2 className="font-headline-sm text-headline-sm text-primary">
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
          </div>

          <aside className="h-fit rounded-[24px] bg-surface-container-low p-5">
            <div className="font-headline-sm text-primary">
              Valutazione
            </div>

            <div className="mt-3 flex items-end gap-2">
              <span className="text-[28px] font-bold text-[#FF8500]">
                {profile.rating_average !== null
                  ? profile.rating_average.toFixed(1)
                  : "—"}
              </span>

              <span className="pb-1 text-sm text-on-surface-variant">
                {profile.reviews_count}{" "}
                {profile.reviews_count === 1 ? "recensione" : "recensioni"}
              </span>
            </div>

            <div className="mt-6 border-t border-outline-variant/30 pt-5">
              <p className="text-sm leading-6 text-on-surface-variant">
                Per contattare il professionista accedi o crea gratuitamente il
                tuo account cliente.
              </p>

              <Link
                href={contactLoginPath}
                className="mt-5 flex w-full items-center justify-center rounded-full bg-[#FF8500] px-5 py-3 font-button text-button text-white transition-colors hover:bg-[#FF9A2B]"
              >
                Contatta
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

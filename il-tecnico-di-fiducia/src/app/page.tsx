import { Footer } from "@/components/site/footer";
import { Container } from "@/components/site/container";
import { TopNav } from "@/components/site/top-nav";
import { ProfessionSearchFlow } from "@/components/site/profession-search-flow";
import { PublicReviewsCarousel } from "@/components/site/public-reviews-carousel";
import { SmoothAnchorLink } from "@/components/site/smooth-anchor-link";
import { getPublicHomepageReviews } from "@/lib/server/public-reviews";
import Image from "next/image";

export const dynamic = "force-dynamic";

const customerSteps = [
  {
    title: "Cerca l’esperto",
    body: "Trova il professionista più adatto alle tue esigenze.",
  },
  {
    title: "Confronta profili",
    body: "Valuta competenze e informazioni utili prima di contattare.",
  },
  {
    title: "Contatta e fissa",
    body: "Invia una richiesta e gestisci tutto dalla chat.",
  },
];

const professionalSteps = [
  {
    title: "Pubblica i tuoi lavori",
    body: "Mostra le tue competenze, i progetti realizzati e i servizi che offri.",
  },
  {
    title: "Fatti conoscere",
    body: "Crea un profilo professionale completo e aumenta la tua visibilità.",
  },
  {
    title: "Rispondi ai clienti",
    body: "Ricevi richieste e mettiti in contatto con persone interessate ai tuoi servizi.",
  },
];

export default async function Home() {
  const publicReviews = await getPublicHomepageReviews();

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />

      <main className="pt-20 sm:pt-[100px]">
        {/* Hero */}
        <section className="relative min-h-[calc(100svh-100px)] flex items-center overflow-hidden">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3vz0vv7le_BC8pwC5ChG1JFlJb6EZ85a2dEQ3fuRyjmE4_pzrok1vloTwAuPEqFpe_RJtW_iIz0vB1I2_2G0-zA1jn661rbqCxbYEHXa8pdJEmzixnBdNcnntVaj6JqxkoxVuVAX3Ply4XQwFwv0OXNenJHTfaQ-0WHWtQtqwWSf2DXdYrahUqwjUEGL2BVRlVRYmWnbPa7TgdNMQwQPjf8nwiDcapnqLqUc5g9RavELG8dmFJJ0VB6JXgYpYDrvsodGkkCMkyrsn"
            alt="Professionisti e tecnici in ambiente di lavoro"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/80 to-primary/60" />

          <Container className="relative z-10 py-16 text-center">
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-white mb-6">
              Trova il tuo{" "}
              <span className="text-on-tertiary-container">tecnico di fiducia</span>
            </h1>
            <p className="font-body-lg text-body-lg text-surface-container-highest mb-10 max-w-[740px] mx-auto">
              La piattaforma che mette in contatto clienti e professionisti qualificati in tutta Italia
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <SmoothAnchorLink
                href="#professioni"
                className="w-full sm:w-auto font-button text-button bg-[#FF8500] text-white px-10 py-4 rounded-full shadow-lg hover:bg-[#FF9A2B] transition-all active:scale-[0.99]"
              >
                Cerca il tuo tecnico di fiducia
              </SmoothAnchorLink>
              <a
                href="/auth/register?role=professional"
                className="w-full sm:w-auto font-button text-button border-2 border-primary-fixed text-primary-fixed px-10 py-4 rounded-full hover:bg-primary-fixed hover:text-primary transition-all"
              >
                Diventa un tecnico di fiducia
              </a>
            </div>

            <div className="flex flex-wrap justify-center gap-8 text-surface-container-highest/90">
              <div className="flex items-center gap-2">
                <span className="text-on-tertiary-container">●</span>
                <span className="font-label-md text-label-md">Professionisti verificati</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-on-tertiary-container">●</span>
                <span className="font-label-md text-label-md">Contatto diretto</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-on-tertiary-container">●</span>
                <span className="font-label-md text-label-md">Ricerca gratuita</span>
              </div>
            </div>
          </Container>
        </section>

        {/* Come funziona */}
        <section id="come-funziona" className="py-20 bg-[#F5F7FA]">
          <Container>
            <div className="text-center mb-12">
              <h2 className="font-headline-md text-headline-md text-primary mb-4">
                Semplice, veloce e sicuro
              </h2>
              <div className="w-20 h-1 bg-[#FF8500] mx-auto" />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <article className="rounded-[32px] border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-[0_10px_32px_rgba(8,43,95,0.08)] sm:p-8">
                <div className="mb-8 flex items-center justify-center gap-3 text-center sm:justify-start sm:text-left">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF8500] text-white" aria-hidden>
                    <span className="material-symbols-outlined block text-[26px] leading-none">
                      search
                    </span>
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    Per chi cerca un professionista
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {customerSteps.map((step, index) => (
                    <div key={step.title} className="text-center">
                      <div className="w-16 h-16 bg-[#FF8500] text-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-md">
                        <span className="font-headline-md text-[28px]">{index + 1}</span>
                      </div>
                      <h4 className="font-headline-sm text-headline-sm text-primary mb-2">
                        {step.title}
                      </h4>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {step.body}
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[32px] border border-primary/10 bg-white p-6 shadow-[0_10px_32px_rgba(8,43,95,0.08)] sm:p-8">
                <div className="mb-8 flex items-center justify-center gap-3 text-center sm:justify-start sm:text-left">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white" aria-hidden>
                    <span className="material-symbols-outlined block text-[26px] leading-none">
                      engineering
                    </span>
                  </span>
                  <h3 className="font-headline-sm text-headline-sm text-primary">
                    Per i professionisti
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {professionalSteps.map((step, index) => (
                    <div key={step.title} className="text-center">
                      <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-md">
                        <span className="font-headline-md text-[28px]">{index + 1}</span>
                      </div>
                      <h4 className="font-headline-sm text-headline-sm text-primary mb-2">
                        {step.title}
                      </h4>
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {step.body}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </Container>
        </section>

        <Container>
          <ProfessionSearchFlow />
        </Container>

        {/* Vantaggi */}
        <section className="py-20 bg-primary relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container rounded-full opacity-20" />
          <Container className="relative z-10">
            <div className="text-center mb-12">
              <h2 className="font-headline-md text-headline-md text-white">
                Perché scegliere la nostra piattaforma
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "Sicurezza",
                  body: "Ogni professionista passa un processo di verifica.",
                },
                { title: "Comunicazione", body: "Chat integrata per parlare direttamente." },
                { title: "Vicinanza", body: "Trova professionisti attivi nella tua zona." },
                { title: "Qualità", body: "Strumenti per una scelta più consapevole." },
              ].map((a) => (
                <div
                  key={a.title}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[20px] p-6 text-white shadow-sm"
                >
                  <div className="w-12 h-12 bg-[#FF8500] rounded-full flex items-center justify-center mb-4">
                    <span className="text-white">★</span>
                  </div>
                  <div className="font-headline-sm text-headline-sm mb-2">
                    {a.title}
                  </div>
                  <p className="font-body-md text-body-md text-surface-variant/90">
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Recensioni */}
        <section className="py-20">
          <Container>
            <PublicReviewsCarousel reviews={publicReviews} />
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}

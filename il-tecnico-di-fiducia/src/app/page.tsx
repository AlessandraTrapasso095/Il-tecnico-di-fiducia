import { Footer } from "@/components/site/footer";
import { Container } from "@/components/site/container";
import { TopNav } from "@/components/site/top-nav";
import { ProfessionSearchFlow } from "@/components/site/profession-search-flow";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopNav />

      <main className="pt-[100px]">
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
              <span className="text-on-tertiary-container">tecnico di fiducia</span>{" "}
              senza perdere tempo
            </h1>
            <p className="font-body-lg text-body-lg text-surface-container-highest mb-10 max-w-[740px] mx-auto">
              Qualità, trasparenza e competenza al tuo servizio in pochi click.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <a
                href="/auth/register"
                className="w-full sm:w-auto font-button text-button bg-[#FF8500] text-white px-10 py-4 rounded-full shadow-lg hover:bg-[#FF9A2B] transition-all active:scale-[0.99]"
              >
                Inizia ora
              </a>
              <a
                href="#professioni"
                className="w-full sm:w-auto font-button text-button border-2 border-primary-fixed text-primary-fixed px-10 py-4 rounded-full hover:bg-primary-fixed hover:text-primary transition-all"
              >
                Esplora professioni
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-[#FF8500] text-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-md">
                  <span className="font-headline-md text-headline-md">1</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                  Cerca l’esperto
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Trova il professionista più adatto alle tue esigenze.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-[#FF8500] text-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-md">
                  <span className="font-headline-md text-headline-md">2</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                  Confronta profili
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Valuta competenze e informazioni utili prima di contattare.
                </p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 bg-[#FF8500] text-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-md">
                  <span className="font-headline-md text-headline-md">3</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary mb-2">
                  Contatta e fissa
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Invia una richiesta e gestisci tutto dalla chat.
                </p>
              </div>
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
                Perché scegliere noi
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

        {/* Recensioni (stato vuoto) */}
        <section className="py-20">
          <Container>
            <div className="bg-surface-container-low rounded-[40px] p-10 text-center border-2 border-dashed border-outline-variant">
              <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-container-high text-outline">
                ★
              </div>
              <h2 className="font-headline-md text-headline-md text-primary mb-4">
                Le recensioni degli utenti
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[640px] mx-auto mb-8">
                Siamo una piattaforma in rapida crescita. Qui troverai le esperienze
                reali degli utenti dopo i primi contatti con i professionisti.
              </p>
              <a
                href="/auth/register"
                className="inline-flex items-center justify-center font-button text-button bg-primary text-white px-8 py-3 rounded-full hover:bg-secondary transition-colors"
              >
                Inizia ora
              </a>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}

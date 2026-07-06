import Image from "next/image";
import Link from "next/link";

import { HeaderBackButton } from "@/components/navigation/header-back-button";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-[minmax(0,45%)_minmax(0,55%)]">
      <aside className="relative hidden lg:flex min-w-0 flex-col justify-between px-12 py-14 overflow-hidden bg-primary">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC6uWFYS_Qa4Y5naY6B0Ga_TwbReMdM9NY7SMO6z3bhvwqFiJNAz2M4_jMhtdN08umK3NUWGRYArxw1RtbGhK-pT-h1Jqpg36CxYxYHbvaDLCNN7K0LY-WPEfEI8iMaI1Jugz9ht-vEG2ZSpgnhaR89gSNyxQ06h3JAUcJSaLbXNUWUEgvQ-A8sJEu0zEnSqW0dZtCufswF0TY0D9RDBL6AJiTz7Wxgo-bvcCFHmhO3dets1UEDGHtZ9SjoIW061cAWJcPX68yFZooY"
            alt="Sfondo area autenticazione"
            fill
            priority
            sizes="(min-width: 1280px) 40vw, (min-width: 1024px) 50vw, 0vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-primary/60" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full gap-12">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <HeaderBackButton
                fallbackHref="/"
                hiddenPathnames={["/auth/login"]}
                className="bg-white/10 text-on-primary hover:bg-white/20"
              />
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="w-12 h-12 bg-on-primary rounded-full flex items-center justify-center">
                  <span className="text-primary text-[28px] font-bold">✓</span>
                </div>
                <span className="font-headline-sm text-headline-sm text-on-primary font-bold">
                  Il tecnico di fiducia
                </span>
              </Link>
            </div>

            <div className="w-full max-w-[560px] text-balance">
              <h2 className="font-display-lg text-display-lg text-on-primary mb-4">
                Bentornato
              </h2>
              <p className="font-body-lg text-body-lg text-primary-fixed-dim leading-relaxed">
                Accedi al tuo portale sicuro per gestire richieste, comunicazioni e attività.
                La tua tranquillità è la nostra priorità.
              </p>
            </div>
          </div>

          <div className="w-full max-w-[384px] bg-white/15 backdrop-blur-md border border-white/20 p-4 rounded-2xl">
            <p className="font-label-md text-label-md text-primary-fixed mb-1">
              CERTIFICAZIONE DI QUALITÀ
            </p>
            <p className="font-body-md text-body-md text-primary-fixed-dim">
              Accesso protetto e controlli anti‑abuso attivi.
            </p>
          </div>
        </div>
      </aside>

      <section className="min-w-0 bg-surface-container-low px-4 sm:px-6 lg:px-12 py-10 sm:py-12 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-[672px]">
          <div className="mb-6 flex items-center gap-3 sm:mb-8 lg:hidden">
            <HeaderBackButton fallbackHref="/" hiddenPathnames={["/auth/login"]} />
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <span className="text-on-primary text-[28px] font-bold">✓</span>
              </div>
              <span className="font-headline-md text-headline-md text-primary">
                Il tecnico di fiducia
              </span>
            </Link>
          </div>

          {children}
        </div>
      </section>
    </div>
  );
}

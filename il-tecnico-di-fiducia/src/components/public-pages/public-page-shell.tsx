import type { ReactNode } from "react";

import { Container } from "@/components/site/container";
import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
}: PublicPageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-surface">
      <TopNav />
      <main className="flex-1 pt-20 sm:pt-[100px]">
        <section className="relative overflow-hidden bg-primary py-14 text-white sm:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,133,0,0.22),transparent_34%),linear-gradient(135deg,#002654,#0b3c78)]" />
          <Container className="relative z-10">
            <p className="font-label-md text-sm uppercase tracking-[0.18em] text-on-tertiary-container">
              {eyebrow}
            </p>
            <h1 className="mt-3 max-w-3xl font-display-lg text-[40px] leading-tight sm:text-[56px]">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-primary-fixed">
              {description}
            </p>
          </Container>
        </section>
        {children}
      </main>
      <Footer />
    </div>
  );
}

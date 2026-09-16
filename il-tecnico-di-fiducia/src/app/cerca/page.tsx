import { Suspense } from "react";

import { Footer } from "@/components/site/footer";
import { TopNav } from "@/components/site/top-nav";
import { PublicProfessionalsSearch } from "@/components/public-search/public-professionals-search";

export const dynamic = "force-dynamic";

export default function PublicSearchPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <TopNav />

      <main className="flex-1 pt-20 sm:pt-[100px]">
        <Suspense
          fallback={
            <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
              Caricamento...
            </div>
          }
        >
          <PublicProfessionalsSearch />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

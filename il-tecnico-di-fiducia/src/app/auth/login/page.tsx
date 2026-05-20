import { Suspense } from "react";

import LoginClient from "./login-client";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const roleRaw = typeof sp.role === "string" ? sp.role : null;
  const initialRole = roleRaw === "professional" ? "professional" : "customer";

  return (
    <Suspense>
      <LoginClient initialRole={initialRole} />
    </Suspense>
  );
}


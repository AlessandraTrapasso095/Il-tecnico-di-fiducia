import { Suspense } from "react";

import RegisterClient from "./register-client";

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const roleRaw = typeof sp.role === "string" ? sp.role : null;
  const nextPath = typeof sp.next === "string" ? sp.next : null;

  const initialRole = roleRaw === "professional" ? "professional" : "customer";

  return (
    <Suspense>
      <RegisterClient initialRole={initialRole} nextPath={nextPath} />
    </Suspense>
  );
}

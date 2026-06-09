import CustomerDashboardClient from "./customer-dashboard-client";

import { requirePageAuth } from "@/lib/server/require-page-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function readParam(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string,
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : "";
}

function readBooleanParam(
  searchParams: { [key: string]: string | string[] | undefined },
  key: string,
) {
  const value = readParam(searchParams, key);
  return value === "true" || value === "1";
}

export default async function CustomerDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requirePageAuth({ allowedRoles: ["customer"] });
  const sp = await searchParams;

  return (
    <CustomerDashboardClient
      profile={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
      }}
      initialFilters={{
        q: readParam(sp, "q"),
        categoryId: readParam(sp, "category_id"),
        provinceCode: readParam(sp, "province_code"),
        remote: readBooleanParam(sp, "remote"),
        travel: readBooleanParam(sp, "travel"),
      }}
    />
  );
}

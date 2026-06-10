import { NextResponse } from "next/server";

import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provinces")
    .select("code, name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ provinces: ITALIAN_PROVINCES_BY_NAME });
  }

  return NextResponse.json({
    provinces: data && data.length > 0 ? data : ITALIAN_PROVINCES_BY_NAME,
  });
}

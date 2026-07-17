import { NextResponse } from "next/server";

import { ITALIAN_PROVINCES_BY_NAME } from "@/lib/locations/italian-provinces";
import { logApiError } from "@/lib/server/api-logger";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const query = "provinces select code, name order name";
    const { data, error } = await supabase
      .from("provinces")
      .select("code, name")
      .order("name", { ascending: true });

    if (error) {
      logApiError("PROVINCES ERROR", {
        query,
        error,
      });
      return NextResponse.json({ provinces: ITALIAN_PROVINCES_BY_NAME });
    }

    return NextResponse.json({
      provinces: data && data.length > 0 ? data : ITALIAN_PROVINCES_BY_NAME,
    });
  } catch (error) {
    logApiError("PROVINCES ERROR", {
      query: "GET /api/provinces",
      error,
    });
    return NextResponse.json({ provinces: ITALIAN_PROVINCES_BY_NAME });
  }
}

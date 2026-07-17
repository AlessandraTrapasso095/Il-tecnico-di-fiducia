import { NextResponse } from "next/server";

import { logApiError } from "@/lib/server/api-logger";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const query = "categories select id, name, slug, image_url order name";
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, image_url")
      .order("name", { ascending: true });

    if (error) {
      logApiError("CATEGORIES ERROR", {
        query,
        error,
      });
      return NextResponse.json({ categories: [] });
    }

    return NextResponse.json({ categories: data ?? [] });
  } catch (error) {
    logApiError("CATEGORIES ERROR", {
      query: "GET /api/categories",
      error,
    });
    return NextResponse.json({ categories: [] });
  }
}

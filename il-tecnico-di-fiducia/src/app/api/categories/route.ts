import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, image_url")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ categories: [] });
  }

  return NextResponse.json({ categories: data ?? [] });
}

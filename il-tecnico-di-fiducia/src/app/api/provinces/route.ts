import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provinces")
    .select("code, name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load provinces" },
      { status: 500 },
    );
  }

  return NextResponse.json({ provinces: data ?? [] });
}


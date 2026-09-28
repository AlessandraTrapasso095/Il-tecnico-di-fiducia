import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { updateSession } from "./lib/supabase/update-session";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function requestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();

  if (incoming && REQUEST_ID_PATTERN.test(incoming)) {
    return incoming;
  }

  return randomUUID();
}

export async function proxy(request: NextRequest) {
  const id = requestId(request);
  const response = await updateSession(request);

  response.headers.set("x-request-id", id);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

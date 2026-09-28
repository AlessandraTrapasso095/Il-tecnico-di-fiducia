import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { logApiError } from "@/lib/server/api-logger";

const INTERNAL_ERROR_MESSAGE =
  "Si è verificato un problema interno. Riprova tra qualche istante.";

export function internalServerError(
  scope: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const requestId = randomUUID();

  logApiError(scope, {
    ...context,
    request_id: requestId,
    error,
  });

  return NextResponse.json(
    {
      error: INTERNAL_ERROR_MESSAGE,
      request_id: requestId,
    },
    {
      status: 500,
      headers: {
        "x-request-id": requestId,
        "cache-control": "no-store",
      },
    },
  );
}

import "server-only";

type ApiLogContext = Record<string, unknown> & {
  error?: unknown;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      code: record.code ?? null,
      message: record.message ?? null,
      details: record.details ?? null,
      hint: record.hint ?? null,
      status: record.status ?? null,
      raw: error,
    };
  }

  return {
    message: typeof error === "string" ? error : null,
    raw: error,
  };
}

export function logApiError(api: string, context: ApiLogContext) {
  const { error, ...rest } = context;
  const serialized = serializeError(error);

  console.error(api, {
    ...rest,
    error: serialized,
    code: "code" in serialized ? serialized.code : null,
    message: serialized.message ?? null,
    details: "details" in serialized ? serialized.details : null,
    hint: "hint" in serialized ? serialized.hint : null,
    status: "status" in serialized ? serialized.status : null,
    stack: "stack" in serialized ? serialized.stack : null,
  });
}

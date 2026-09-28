import "server-only";

type ApiLogContext = Record<string, unknown> & {
  error?: unknown;
};

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|cookie|api[_-]?key|access[_-]?key|private[_-]?key)/i;

const EMAIL_KEY_PATTERN =
  /(^|_)(email|recipient|sender|from|to|reply_to|replyto)($|_)/i;

const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

function sanitizeString(value: string) {
  return value.replace(
    EMAIL_VALUE_PATTERN,
    (_match, domain: string) => `***@${domain}`,
  );
}

function sanitizeLogValue(
  value: unknown,
  key: string | null = null,
  depth = 0,
): unknown {
  if (depth > 6) {
    return "[max-depth]";
  }

  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    if (key && EMAIL_KEY_PATTERN.test(key)) {
      return sanitizeString(value);
    }

    return sanitizeString(value);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, key, depth + 1));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [nestedKey, nestedValue] of Object.entries(record)) {
      sanitized[nestedKey] = sanitizeLogValue(
        nestedValue,
        nestedKey,
        depth + 1,
      );
    }

    return sanitized;
  }

  return String(value);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const record = error as Error & Record<string, unknown>;

    return {
      name: sanitizeString(error.name),
      message: sanitizeString(error.message),
      code: sanitizeLogValue(record.code, "code"),
      details: sanitizeLogValue(record.details, "details"),
      hint: sanitizeLogValue(record.hint, "hint"),
      status: sanitizeLogValue(record.status, "status"),
      stack: error.stack ? sanitizeString(error.stack) : null,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    return {
      name: sanitizeLogValue(record.name, "name"),
      code: sanitizeLogValue(record.code, "code"),
      message: sanitizeLogValue(record.message, "message"),
      details: sanitizeLogValue(record.details, "details"),
      hint: sanitizeLogValue(record.hint, "hint"),
      status: sanitizeLogValue(record.status, "status"),
      stack: sanitizeLogValue(record.stack, "stack"),
    };
  }

  return {
    name: null,
    code: null,
    message: typeof error === "string" ? sanitizeString(error) : null,
    details: null,
    hint: null,
    status: null,
    stack: null,
  };
}

export function logApiError(api: string, context: ApiLogContext) {
  const { error, ...rest } = context;
  const serialized = serializeError(error);
  const sanitizedContext = sanitizeLogValue(rest) as Record<string, unknown>;

  console.error(api, {
    ...sanitizedContext,
    error: serialized,
    code: serialized.code ?? null,
    message: serialized.message ?? null,
    details: serialized.details ?? null,
    hint: serialized.hint ?? null,
    status: serialized.status ?? null,
    stack: serialized.stack ?? null,
  });
}

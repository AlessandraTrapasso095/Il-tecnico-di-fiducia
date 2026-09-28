import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/messages/messages-client.tsx", "utf8");

const normalizedSource = source.replace(/\s+/g, " ");

describe("review request id fallback contract", () => {
  it("uses the active conversation request id when detail is not hydrated yet", () => {
    expect(normalizedSource).toContain(
      "activeDetail?.request?.id ?? activeConvListRow?.request_id ?? null",
    );

    expect(normalizedSource).toContain(
      "conversationsRef.current.find( (conversation) => conversation.id === activeId, )?.request_id ?? null",
    );
  });

  it("does not silently ignore a missing review request id", () => {
    expect(normalizedSource).toContain(
      "Impossibile identificare la richiesta. Riprova tra qualche istante.",
    );

    expect(normalizedSource).not.toContain(
      "const requestId = activeDetail?.request?.id ?? null; if (!requestId) return;",
    );
  });
});

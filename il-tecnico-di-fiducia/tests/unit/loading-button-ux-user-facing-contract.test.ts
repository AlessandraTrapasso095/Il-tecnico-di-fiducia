import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

const messages = read("src/app/messages/messages-client.tsx");
const support = read(
  "src/app/professionista/supporto/professional-support-client.tsx",
);
const dashboard = read(
  "src/app/professionista/professional-dashboard-client.tsx",
);
const postMediaUi = read("src/components/posts/post-media-ui.tsx");

describe("user-facing async button loading UX", () => {
  it("shows spinner and Caricamento in message actions", () => {
    expect(messages).toContain("progress_activity");
    expect(messages).toContain("Caricamento…");
    expect(messages).toContain("aria-busy={sending}");
    expect(messages).toContain("Invia preventivo");
    expect(messages).toContain("Invia recensione");
    expect(messages).toContain("const [deletingChat, setDeletingChat]");
    expect(messages).toContain("aria-busy={deletingChat}");
    expect(messages).toContain("setDeletingChat(true)");
    expect(messages).toContain("setDeletingChat(false)");
  });

  it("shows spinner and Caricamento in professional support actions", () => {
    expect(support).toContain("progress_activity");
    expect(support).toContain("Caricamento…");
    expect(support).toContain("disabled={submitting}");
    expect(support).toContain("disabled={replying || !replyBody.trim()}");
  });

  it("shows spinner and Caricamento in professional post actions", () => {
    expect(dashboard).toContain("progress_activity");
    expect(dashboard).toContain("Caricamento…");
    expect(dashboard).toContain("posting ||");
    expect(dashboard).toContain("optimizingMedia ||");
    expect(dashboard).toContain("!postTitle.trim()");
    expect(dashboard).toContain("!postBody.trim()");
    expect(dashboard).toContain("busyPostId === post.id");
  });

  it("shows spinner in shared post confirm and edit actions", () => {
    expect(postMediaUi).toContain("progress_activity");
    expect(postMediaUi).toContain("Caricamento…");
    expect(postMediaUi).toContain("disabled={busy || confirmDisabled}");
    expect(postMediaUi).toContain('"Salva modifiche"');
  });
});

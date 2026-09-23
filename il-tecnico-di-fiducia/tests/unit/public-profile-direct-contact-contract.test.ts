import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("public profile direct contact contract", () => {
  it("opens contact directly for authenticated customers", () => {
    expect(source).toContain("const [contactOpen, setContactOpen]");
    expect(source).toContain("function openContact()");
    expect(source).toContain("onClick={openContact}");
  });

  it("submits through the existing contact request API", () => {
    expect(source).toContain('fetch("/api/contact-requests"');
    expect(source).toContain("professional_id: profile.id");
    expect(source).toContain("privacy_accepted: true");
  });

  it("supports attachments", () => {
    expect(source).toContain(
      "`/api/contact-requests/${payload.request.id}/attachments`",
    );
  });

  it("keeps guest resume through the profile URL and consumes the action after opening", () => {
    expect(source).toContain(
      "const contactPath = `${profilePath}?action=contact`;",
    );
    expect(source).toContain(
      "const contactLoginPath = `/auth/login?next=${encodeURIComponent(contactPath)}`;",
    );
    expect(source).toContain('searchParams.get("action") !== "contact"');
    expect(source).toContain('nextParams.delete("action");');
    expect(source).toContain("window.history.replaceState(");
  });

  it("uses the global async loading convention", () => {
    expect(source).toContain("progress_activity");
    expect(source).toContain("Caricamento…");
    expect(source).toContain("aria-busy={contactSending}");
  });
});

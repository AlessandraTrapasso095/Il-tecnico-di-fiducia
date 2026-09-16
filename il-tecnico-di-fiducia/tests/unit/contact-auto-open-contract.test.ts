import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/professionals/professional-profile-client.tsx",
  ),
  "utf8",
);

describe("contact auto-open contract", () => {
  it("reads the contact action from the profile URL", () => {
    expect(source).toContain(
      'const requestedAction = searchParams.get("action");',
    );
  });

  it("opens the existing contact modal only for customer viewers", () => {
    expect(source).toContain('requestedAction === "contact"');
    expect(source).toContain('viewer.role === "customer"');
    expect(source).toContain("!isOwner");
    expect(source).toContain("setContactOpen(true);");
  });

  it("resets stale contact completion and error state before reopening", () => {
    expect(source).toContain("setContactDone(false);");
    expect(source).toContain("setContactError(null);");
  });

  it("keeps the existing contact modal and submission flow", () => {
    expect(source).toContain("{contactOpen ? (");
    expect(source).toContain("<ContactModal");
    expect(source).toContain("onSubmit={() => void sendContactRequest()}");
    expect(source).toContain('"/api/contact-requests"');
  });
});

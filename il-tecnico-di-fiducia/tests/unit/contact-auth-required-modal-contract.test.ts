import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const modal = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/auth/contact-auth-required-modal.tsx",
  ),
  "utf8",
);

const search = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-search/public-professionals-search.tsx",
  ),
  "utf8",
);

const profile = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

describe("guest contact authentication prompt", () => {
  it("offers login and registration before contact", () => {
    expect(modal).toContain("Vuoi contattare questo professionista?");
    expect(modal).toContain("devi essere registrato/a");
    expect(modal).toContain("Accedi");
    expect(modal).toContain("Registrati");
    expect(modal).toContain('aria-label="Chiudi"');
  });

  it("opens from the public search instead of redirecting immediately", () => {
    expect(search).toContain("setAuthPrompt({");
    expect(search).toContain("registerHref: registerPath");
    expect(search).toContain("<ContactAuthRequiredModal");
    expect(search).not.toContain("href={loginPath}");
  });

  it("opens from the public profile instead of redirecting immediately", () => {
    expect(profile).toContain("setGuestContactPromptOpen(true)");
    expect(profile).toContain("<ContactAuthRequiredModal");
    expect(profile).toContain("registerHref={contactRegisterPath}");
  });
});

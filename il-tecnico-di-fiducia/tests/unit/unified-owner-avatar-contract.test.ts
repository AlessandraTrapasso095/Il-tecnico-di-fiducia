import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const unifiedProfile = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/public-professional-profile.tsx",
  ),
  "utf8",
);

const avatarComponent = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/components/public-profile/owner-editable-avatar.tsx",
  ),
  "utf8",
);

const avatarApi = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/uploads/avatar/route.ts"),
  "utf8",
);

describe("unified owner avatar editing", () => {
  it("renders owner-aware avatar from unified profile", () => {
    expect(unifiedProfile).toContain("<OwnerEditableAvatar");

    expect(unifiedProfile).toContain(
      "isOwner={viewerContext?.isOwner === true}",
    );
  });

  it("shows edit controls only to the owner", () => {
    expect(avatarComponent).toContain("{isOwner ? (");

    expect(avatarComponent).toContain('aria-label="Modifica foto profilo"');
  });

  it("uses the existing avatar upload endpoint", () => {
    expect(avatarComponent).toContain('"/api/uploads/avatar"');

    expect(avatarComponent).toContain('formData.append("file", cropped)');

    expect(avatarApi).toContain('formData.get("file")');
  });

  it("keeps the established 512 square crop", () => {
    expect(avatarComponent).toContain("const width = 512");

    expect(avatarComponent).toContain("const height = 512");

    expect(avatarComponent).toContain('"image/jpeg"');

    expect(avatarComponent).toContain("0.9");
  });

  it("keeps API file restrictions unchanged", () => {
    expect(avatarApi).toContain('"image/jpeg"');

    expect(avatarApi).toContain('"image/png"');

    expect(avatarApi).toContain('"image/webp"');

    expect(avatarApi).toContain("6 * 1024 * 1024");
  });

  it("updates shell and dashboard through the existing event", () => {
    expect(avatarComponent).toContain('"professional-avatar-updated"');

    expect(avatarComponent).toContain("avatar_url:");
  });

  it("does not add storage logic to the client", () => {
    expect(avatarComponent).not.toContain('.storage.from("public-media")');

    expect(avatarApi).toContain('.from("public-media")');
  });
});

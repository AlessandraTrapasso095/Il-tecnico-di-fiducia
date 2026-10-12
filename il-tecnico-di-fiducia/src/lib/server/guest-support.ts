import "server-only";

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

function guestSupportTokenSecret() {
  const secret = process.env.GUEST_SUPPORT_TOKEN_SECRET?.trim();

  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "GUEST_SUPPORT_TOKEN_SECRET must contain at least 32 characters",
    );
  }

  return secret;
}

export function generateGuestAccessToken(ticketId: string) {
  if (!ticketId.trim()) {
    throw new Error("Guest support ticket id is required");
  }

  return createHmac("sha256", guestSupportTokenSecret())
    .update(`guest-support:${TOKEN_VERSION}:${ticketId}`, "utf8")
    .digest("base64url");
}

export function hashGuestAccessToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function guestAccessTokenMatches({
  token,
  expectedHash,
}: {
  token: string;
  expectedHash: string;
}) {
  if (!token || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashGuestAccessToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function guestTicketUrl({
  ticketId,
  token,
}: {
  ticketId: string;
  token: string;
}) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_URL ??
    "http://localhost:3002"
  ).replace(/\/$/, "");

  return `${baseUrl}/assistenza/ticket/${encodeURIComponent(
    ticketId,
  )}?token=${encodeURIComponent(token)}`;
}

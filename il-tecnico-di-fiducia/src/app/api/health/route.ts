import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildIdentifier() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

  if (!sha) return null;

  return sha.slice(0, 12);
}

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "il-tecnico-di-fiducia",
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      build: buildIdentifier(),
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}

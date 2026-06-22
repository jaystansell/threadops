import crypto from "crypto";
import { NextResponse } from "next/server";

// Generated once at build/startup time — changes on every new deployment
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_BUILD_ID ??
  crypto.randomUUID();

export function GET() {
  return NextResponse.json(
    { version: BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

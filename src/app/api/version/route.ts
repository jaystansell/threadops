import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveBuildId(): string {
  // Vercel always sets this
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  // Next.js writes a BUILD_ID file during `next build`
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    const id = fs.readFileSync(buildIdPath, "utf-8").trim();
    if (id) return id;
  } catch {
    // not available
  }
  return "dev";
}

const BUILD_ID = resolveBuildId();

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

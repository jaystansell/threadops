import { NextRequest } from "next/server";
import { createServerClient } from "@/adapters/supabase/client";
import { createAttachmentRepo } from "@/adapters/supabase/attachment-repo";
import { FILE_LIMITS } from "@/core/types";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  const attachmentRepo = createAttachmentRepo(db);

  let totalPurged = 0;
  let totalErrors = 0;
  let hasMore = true;

  while (hasMore) {
    const expired = await attachmentRepo.listExpired(
      FILE_LIMITS.RETENTION_DAYS,
      BATCH_SIZE,
    );

    if (expired.length === 0) {
      hasMore = false;
      break;
    }

    const purgedIds: string[] = [];

    for (const attachment of expired) {
      const { error } = await db.storage
        .from("thread-attachments")
        .remove([attachment.storage_path]);

      if (error) {
        totalErrors++;
      } else {
        purgedIds.push(attachment.id);
      }
    }

    if (purgedIds.length > 0) {
      await attachmentRepo.markPurged(purgedIds);
      totalPurged += purgedIds.length;
    } else {
      // No progress made — stop to avoid infinite loop during storage outages
      hasMore = false;
    }

    if (expired.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  return Response.json({
    message: "File purge complete",
    purged: totalPurged,
    errors: totalErrors,
  });
}

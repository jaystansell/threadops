import { after } from "next/server";
import webpush from "web-push";
import type { CompanyId } from "@/core/types";
import { createServerClient } from "./client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@threadzy.ai";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

/**
 * Send push notifications to all subscribed users of a company.
 * Runs in the background via Next.js after() so it doesn't block the response.
 */
export function dispatchPushNotifications(
  companyId: CompanyId,
  eventType: string,
  payload: PushPayload,
): void {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const work = async () => {
    try {
      const db = createServerClient();

      // Get all push subscriptions for this company
      const { data: subscriptions, error } = await db
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth, user_id")
        .eq("company_id", companyId);

      if (error || !subscriptions?.length) return;

      const notification = JSON.stringify({
        title: payload.title,
        body: payload.body,
        tag: payload.tag ?? `threadzy-${eventType}`,
        url: payload.url ?? "/threads",
      });

      const expiredIds: string[] = [];

      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              notification,
              { TTL: 3600 },
            );
          } catch (err: unknown) {
            // 410 Gone or 404 means the subscription expired
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 410 || statusCode === 404) {
              expiredIds.push(sub.id);
            }
          }
        }),
      );

      // Clean up expired subscriptions
      if (expiredIds.length > 0) {
        await db
          .from("push_subscriptions")
          .delete()
          .in("id", expiredIds);
      }
    } catch {
      // Fire-and-forget
    }
  };

  after(work);
}

/**
 * Build push notification content from webhook event data.
 * Returns null if the event type should not trigger a push notification.
 */
export function buildPushPayload(
  eventType: string,
  eventPayload: Record<string, unknown>,
): PushPayload | null {
  const threadId = eventPayload.thread_id as string | undefined;
  const threadUrl = threadId ? `/threads/${threadId}` : "/threads";

  switch (eventType) {
    case "message.created": {
      // Only notify for agent messages (not user's own messages)
      if (eventPayload.author_kind !== "agent") return null;
      const agentName = (eventPayload.author_name as string) ?? "An agent";
      const bodyPreview = truncate(eventPayload.body as string, 100);
      return {
        title: `${agentName} replied`,
        body: bodyPreview,
        tag: `msg-${eventPayload.message_id}`,
        url: threadUrl,
      };
    }

    case "message.ack": {
      const agentName = (eventPayload.agent_label as string) ?? "An agent";
      return {
        title: `${agentName} acknowledged`,
        body: "Your message was received and is being processed.",
        tag: `ack-${threadId}`,
        url: threadUrl,
      };
    }

    case "thread.status_changed": {
      const newStatus = eventPayload.new_status as string;
      const prevStatus = eventPayload.previous_status as string;
      if (newStatus === "open" && prevStatus === "archived") {
        return {
          title: "Thread reopened",
          body: "An agent posted a new message to an archived thread.",
          tag: `status-${threadId}`,
          url: threadUrl,
        };
      }
      return null;
    }

    case "thread.unhandled": {
      return {
        title: "Unhandled message",
        body: "An agent did not respond within the expected time.",
        tag: `unhandled-${threadId}`,
        url: threadUrl,
      };
    }

    default:
      return null;
  }
}

function truncate(text: string | undefined, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

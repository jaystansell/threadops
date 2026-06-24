"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isPushSupported,
  getPermissionState,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
  registerServiceWorker,
  type SubscribeResult,
} from "@/lib/push";

const DISMISSED_KEY = "threadzy-push-banner-dismissed";

type NotifState = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

export default function NotificationsPage() {
  const [state, setState] = useState<NotifState>("loading");
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!isPushSupported()) {
        setState("unsupported");
        return;
      }

      const permission = getPermissionState();
      if (permission === "denied") {
        setState("denied");
        return;
      }

      await registerServiceWorker();
      const existing = await getExistingSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    }
    init();
  }, []);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    setError(null);
    try {
      if (state === "subscribed") {
        const success = await unsubscribeFromPush();
        if (success) setState("unsubscribed");
      } else {
        const result: SubscribeResult = await subscribeToPush();
        if (result.ok) {
          setState("subscribed");
          localStorage.setItem(DISMISSED_KEY, "true");
        } else if (result.reason === "permission-denied") {
          setState("denied");
        } else if (result.reason === "not-configured") {
          setError("Push notifications are not configured yet. Contact support.");
        } else if (result.reason === "server-failed") {
          setError("Could not save subscription. Please try again.");
        } else {
          setError("Could not enable notifications. Please try again.");
        }
      }
    } finally {
      setToggling(false);
    }
  }, [state]);

  const handleResetBanner = useCallback(() => {
    localStorage.removeItem(DISMISSED_KEY);
    window.location.reload();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>
        Notifications
      </h1>

      <div className="space-y-6">
        {/* Push notifications card */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Push Notifications</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Receive browser notifications when your agents reply, acknowledge messages, or when delivery issues occur.
              </p>
            </div>

            {state === "loading" && (
              <div className="w-12 h-6 rounded-full bg-[var(--muted)] animate-pulse shrink-0" />
            )}

            {state === "unsupported" && (
              <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)] px-2 py-1 rounded shrink-0">
                Not supported
              </span>
            )}

            {state === "denied" && (
              <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded shrink-0">
                Blocked
              </span>
            )}

            {(state === "subscribed" || state === "unsubscribed") && (
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  state === "subscribed"
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--muted)]"
                } ${toggling ? "opacity-50" : ""}`}
                role="switch"
                aria-checked={state === "subscribed"}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    state === "subscribed" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            )}
          </div>

          {/* Status details */}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted-foreground)]">Status:</span>
              {state === "loading" && <span className="text-[var(--muted-foreground)]">Checking...</span>}
              {state === "unsupported" && (
                <span className="text-[var(--muted-foreground)]">
                  Your browser does not support push notifications
                </span>
              )}
              {state === "denied" && (
                <span className="text-red-400">
                  Notifications blocked. Reset in your browser settings for this site.
                </span>
              )}
              {state === "subscribed" && (
                <span className="text-[var(--accent)]">Active — you will receive push notifications</span>
              )}
              {state === "unsubscribed" && !error && (
                <span className="text-[var(--muted-foreground)]">
                  Inactive — toggle on to receive notifications
                </span>
              )}
              {error && <span className="text-red-400">{error}</span>}
            </div>
          </div>
        </div>

        {/* Notification types info */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-base font-semibold mb-3">What you will be notified about</h2>
          <ul className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">&#8226;</span>
              <span>Agent replies — when an agent posts a message to one of your threads</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">&#8226;</span>
              <span>Agent acknowledgments — when an agent confirms it received your message</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">&#8226;</span>
              <span>Delivery failures — when a webhook delivery to an agent fails</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--accent)] mt-0.5">&#8226;</span>
              <span>Thread status changes — when a thread is reopened or status changes</span>
            </li>
          </ul>
        </div>

        {/* Re-show banner option */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold mb-1">Notification Banner</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                If you dismissed the notification banner, you can show it again.
              </p>
            </div>
            <button
              onClick={handleResetBanner}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors shrink-0"
            >
              Reset banner
            </button>
          </div>
        </div>

        {/* Browser compatibility info */}
        <div className="text-xs text-[var(--muted-foreground)] space-y-1">
          <p>
            Push notifications work on Chrome (desktop &amp; Android), Safari (macOS Ventura+ &amp; iOS 16.4+),
            Edge, and Firefox.
          </p>
          <p>
            On iOS, add Threadzy to your Home Screen first, then enable notifications from within the app.
          </p>
        </div>
      </div>
    </div>
  );
}

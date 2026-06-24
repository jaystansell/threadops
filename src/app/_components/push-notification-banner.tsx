"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isPushSupported,
  getPermissionState,
  subscribeToPush,
  registerServiceWorker,
  getExistingSubscription,
} from "@/lib/push";

const DISMISSED_KEY = "threadzy-push-banner-dismissed";

/**
 * Footer banner that prompts users to enable push notifications.
 * Dismissible with state persisted to localStorage.
 * Only shows for authenticated users on app pages (not marketing pages).
 */
export function PushNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    async function checkState() {
      // Don't show if not supported
      if (!isPushSupported()) return;

      // Don't show if already dismissed
      if (localStorage.getItem(DISMISSED_KEY) === "true") return;

      // Don't show if permission already granted and subscribed
      const permission = getPermissionState();
      if (permission === "denied") return;

      if (permission === "granted") {
        // Check if already subscribed
        await registerServiceWorker();
        const existing = await getExistingSubscription();
        if (existing) return;
      }

      setVisible(true);
    }
    checkState();
  }, []);

  const handleEnable = useCallback(async () => {
    setSubscribing(true);
    try {
      const sub = await subscribeToPush();
      if (sub) {
        setVisible(false);
        localStorage.setItem(DISMISSED_KEY, "true");
      } else {
        // Permission denied or error — hide banner
        setVisible(false);
        localStorage.setItem(DISMISSED_KEY, "true");
      }
    } finally {
      setSubscribing(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "true");
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="shrink-0 text-[var(--accent)]"
          >
            <path
              d="M10 2C7.24 2 5 4.24 5 7v3.59L3.59 12A2 2 0 005 15h10a2 2 0 001.41-3L15 10.59V7c0-2.76-2.24-5-5-5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8 15a2 2 0 004 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm text-[var(--muted-foreground)] truncate">
            Get notified when your agents reply or need attention
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleEnable}
            disabled={subscribing}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {subscribing ? "Enabling..." : "Enable notifications"}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

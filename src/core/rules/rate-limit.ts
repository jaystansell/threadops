/**
 * In-memory sliding-window rate limiter.
 *
 * Each Vercel serverless instance maintains its own window, so a single
 * instance can enforce the limit even without shared state. For most
 * abuse patterns (agent loops, compromised keys) this is sufficient.
 *
 * To upgrade to shared state later, swap the Map for Upstash Redis:
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 */

const windows = new Map<string, number[]>();
let lastCleanup = Date.now();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

/**
 * Check whether a request identified by `key` should be allowed.
 *
 * Returns `{ allowed, remaining }` and optionally `retryAfterMs` when blocked.
 */
export function checkRateLimit(
  key: string,
  {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
  }: { windowMs?: number; maxRequests?: number } = {},
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();

  // Periodic cleanup to prevent memory leaks in long-lived instances
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    for (const [k, ts] of windows) {
      const fresh = ts.filter((t) => now - t < windowMs);
      if (fresh.length === 0) windows.delete(k);
      else windows.set(k, fresh);
    }
  }

  const timestamps = (windows.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0]!;
    const retryAfterMs = windowMs - (now - oldest);
    windows.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  timestamps.push(now);
  windows.set(key, timestamps);

  return { allowed: true, remaining: maxRequests - timestamps.length };
}

/**
 * Build a 429 JSON response with standard rate-limit headers.
 */
export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return Response.json(
    { error: "Rate limit exceeded. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(DEFAULT_MAX_REQUESTS),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

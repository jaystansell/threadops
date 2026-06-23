const DEFAULT_APP_URL = "https://threadzy.ai";

/** Server-side app URL from env, falling back to threadzy.ai */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
}

/** Client-side app URL using window.location.origin with env fallback */
export function getClientAppUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
}

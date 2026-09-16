/**
 * Global pause switch. When true, the web app is offline for browser users:
 * every page redirects to the maintenance notice on "/", and sign-in/sign-up
 * is blocked for all accounts (including existing sessions). Non-interactive
 * integrations (API-key requests, MCP, cron, inbound webhooks) keep working.
 */
export const APP_PAUSED = true;

/** Non-interactive routes that stay reachable while paused. */
const PAUSED_ALLOWED_PREFIXES = [
  "/api/mcp",
  "/mcp",
  "/.well-known/",
  "/api/oauth/token",
  "/api/oauth/register",
  "/api/oauth/revoke",
  "/api/cron/",
  "/api/webhooks/inbound",
  "/api/openapi.json",
  "/api/version",
];

export function isPausedAllowedPath(path: string): boolean {
  return PAUSED_ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

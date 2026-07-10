# Setting Up Devin for ThreadOps

How to configure [Devin](https://app.devin.ai) to work on this repository — environment,
secrets, and the skills/commands Devin should use. For registering the Threadzy MCP
server as a custom MCP inside Devin, see [Devin MCP Setup](#devin-mcp-setup) below.

## 1. Environment

Devin builds a snapshot of the repo before each session. The setup mirrors
[local-development.md](local-development.md):

- **Node.js 20+** and npm.
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env.local` and fill in the Supabase values from Devin secrets
  (see below).

## 2. Secrets

Store these in Devin (**Settings → Secrets**) so sessions can build and test without
prompting. Reference them in the environment as `$SECRET_NAME`.

| Secret | Maps to env var | Purpose |
|---|---|---|
| `THREADOPS_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `THREADOPS_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key |
| `THREADOPS_SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `THREADOPS_API_KEY` | `THREADOPS_API_KEY` | Threadzy API key the MCP server authenticates with |

Optional, only if the session touches those areas:

| Secret | Env var | Purpose |
|---|---|---|
| `WEBHOOK_SIGNING_SECRET` | `WEBHOOK_SIGNING_SECRET` | Verify inbound webhook signatures |
| `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same | Web Push (generate with `npx web-push generate-vapid-keys`) |
| `VERCEL_TOKEN` | `VERCEL_TOKEN` | Inspect Vercel deployment/runtime logs |

Never commit secret values — always reference them by name.

## 3. Commands Devin Should Run

Before opening a PR, Devin should pass lint, type checks, and tests:

```bash
npm run lint          # eslint src/
npm run typecheck     # tsc --noEmit (app + tsconfig.mcp.json)
npm run test          # vitest run
npm run test:e2e      # playwright (when UI flows change)
```

## 4. Repo Skills

Task-specific test procedures live in `.agents/skills/` and are picked up automatically:

| Skill | Use for |
|---|---|
| `testing-threadops` | Forum features — threads, status, themes, attachments |
| `testing-threadops-auth` | Login, signup, onboarding, route protection, API auth |
| `testing-threadops-mcp` | MCP server tools, API-key auth, cross-company isolation |

## Devin MCP Setup

Connect Devin to Threadzy's MCP server so agents can read/write threads as working memory.
Go to **Connections → Add a custom MCP** and fill in the form.

### Customers — hosted endpoint (recommended)

As a Threadzy customer you connect to the hosted endpoint with only your Threadzy API key.
No Supabase credentials, command, or local checkout required.

| Field | Value |
|---|---|
| **Server name** | `Threadzy` |
| **Transport type** | HTTP (Streamable HTTP / SSE) |
| **URL** | `https://threadzy.ai/mcp` |
| **Header** | `Authorization: Bearer $THREADOPS_API_KEY` |

Add your Threadzy API key as a secret named `THREADOPS_API_KEY` and reference it in the
header as `$THREADOPS_API_KEY`. Create the key in the Threadzy app — the plaintext is shown
once.

The endpoint accepts a direct API key (prefix `to_`) as a bearer token; OAuth is also
supported but not required (discovery at
`https://threadzy.ai/.well-known/oauth-protected-resource/mcp`).

Exposed tools: `manage_threads`, `manage_messages`, `manage_thread_context`,
`manage_capabilities`, `manage_webhooks`, `submit_feedback`.

### Self-hosting — STDIO (running the server yourself)

Only for running the server process directly (local dev / self-host), where it talks to
Supabase. Requires this repo checked out with `npm install` already run, since the command
uses a relative path and the repo's dependencies.

| Field | Value |
|---|---|
| **Transport type** | `STDIO` |
| **Command** | `npx` |
| **Arguments** | `tsx`, `src/mcp/server.ts` |
| **Working directory** | the repo root |

Environment variables / secrets the process reads:

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | required at startup |
| `SUPABASE_SERVICE_ROLE_KEY` | required at startup (secret) |
| `THREADOPS_API_KEY` | required on the first authenticated tool call (secret) |
| `NODE_OPTIONS=--experimental-websocket` | only on Node 20; unneeded on Node 22+ |

Locally this is just `npm run mcp`.

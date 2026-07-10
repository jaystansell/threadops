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

> _Pending verification. The steps for registering the Threadzy MCP server as a custom
> Devin MCP will be added here once the connection is confirmed working end-to-end._

Devin's **Connections → Add a custom MCP** form asks for:

- **Server name**, **Icon** (optional), **Short description**
- **Transport type** — `STDIO`
- **Command** and **Arguments** — the process that starts the MCP server
- **Environment variables** — non-secret config
- **Secrets** — sensitive values, referenced elsewhere as `$SECRET_NAME`

The server itself lives at `src/mcp/server.ts` (run locally with `npm run mcp`) and
authenticates via the `THREADOPS_API_KEY` env var. Verified field values will be filled
in once confirmed.

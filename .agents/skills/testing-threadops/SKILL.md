---
name: testing-threadops
description: Test the ThreadOps forum app end-to-end. Use when verifying UI, API routes, or database changes against a live Supabase project.
---

# Testing ThreadOps

## Devin Secrets Needed

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (bypasses RLS)

These should be in `.env.local` at the repo root. If missing, check the Supabase dashboard for the project `gymsbxkuiknbdtulmopv` or ask the user.

## Environment Setup

### IPv6 DNS Issue

This VM does not support IPv6. Supabase hostnames resolve to IPv6 addresses, which causes Node.js connections to fail with "Invalid API key" or connection timeouts. The Supabase REST API may work via curl (which falls back to IPv4) while the Node.js Supabase client fails.

**Fix:** Start the dev server with:
```bash
NODE_OPTIONS='--dns-result-order=ipv4first' npm run dev
```

### Shell Environment Variables Override .env.local

If previous sessions set Supabase env vars in the shell (e.g., for a different project like ExecReps), those shell env vars will **override** `.env.local`. This causes the app to connect to the wrong Supabase project.

**Fix:** Before starting the dev server, unset any conflicting shell vars:
```bash
unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
```

### Full Dev Server Start Command
```bash
unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
cd /home/ubuntu/repos/threadops
NODE_OPTIONS='--dns-result-order=ipv4first' npm run dev
```

## Key URLs and IDs

- **Demo Company ID:** `a0000000-0000-0000-0000-000000000001`
- **Demo Thread ID:** `d0000000-0000-0000-0000-000000000001`
- **Supabase project ref:** `gymsbxkuiknbdtulmopv`
- **Vercel deployment:** `https://threadops-jade.vercel.app/` (requires env vars configured in Vercel)

## Test Flows

### UI Navigation (Browser)
1. Home page (`/`) shows "Welcome to ThreadOps" with Threads and Webhooks cards
2. `/threads` shows thread list with count badge and "open" status
3. `/threads/<threadId>` shows thread detail with messages timeline and composer
4. "All Threads" back link navigates correctly

### Message Posting
1. Type in the composer textarea on thread detail page
2. Click "Send Message"
3. Textarea clears on success (no error message)
4. Refresh to verify message persisted with "user" author kind badge

Note: Messages may not appear in realtime without refresh. Supabase Realtime must be enabled on the `messages` table in the Supabase dashboard (Database > Replication).

### API Key Generation (curl)
```bash
# Create key — valid scopes: threads:read, threads:write, messages:read, messages:write, webhooks:read
curl -s -X POST http://localhost:3000/api/companies/a0000000-0000-0000-0000-000000000001/api-keys \
  -H "Content-Type: application/json" \
  -d '{"label": "test-key", "scopes": ["threads:read"]}'

# List keys — should show key_hash and key_prefix, never plaintext_key
curl -s http://localhost:3000/api/companies/a0000000-0000-0000-0000-000000000001/api-keys
```

### Webhook Ingestion (curl)
```bash
# First request — expect 202 Accepted
curl -s -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-api-key: <plaintext_key_from_above>" \
  -H "x-idempotency-key: test-idem-001" \
  -d '{"source": "test", "event_type": "ping", "data": {}}'

# Duplicate — expect 200 "Already processed" with same delivery_id
curl -s -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-api-key: <plaintext_key_from_above>" \
  -H "x-idempotency-key: test-idem-001" \
  -d '{"source": "test", "event_type": "ping", "data": {}}'
```

### Error Handling
- Missing `x-api-key` header → 401 `"Missing x-api-key header"`
- Invalid API key → 401 `"Invalid API key"`
- Empty message body → 400 `"body is required and must be a string"`
- Invalid scopes (e.g. `["admin:delete"]`) → 400 `"Invalid scopes provided"`

## Database

Migrations are in `infra/migrations/` (000-007). Seed data is in `infra/seed/seed.sql`.

To apply migrations via psql (pooler connection, bypasses IPv6 issue):
```bash
export DBURL="postgres://postgres.gymsbxkuiknbdtulmopv:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
for f in infra/migrations/*.sql; do psql "$DBURL" -f "$f"; done
psql "$DBURL" -f infra/seed/seed.sql
```

The Supabase MCP tool's `execute_sql` might be read-only for DDL. If so, use the psql pooler connection above.

## Lint and Type Check
```bash
npm run lint
npx tsc --noEmit
```

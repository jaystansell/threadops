---
name: testing-threadops
description: Test the ThreadOps forum app end-to-end. Use when verifying UI, API routes, or database changes against a live Supabase project.
---

# Testing ThreadOps

## Devin Secrets Needed

- `THREADOPS_SUPABASE_SECRET_KEY` — Supabase secret/service role key (bypasses RLS). Stored as a user-scoped Devin secret.
- The anon key and project URL can be retrieved via the Supabase MCP (`get_publishable_keys` for project `gymsbxkuiknbdtulmopv`).

These should be in `.env.local` at the repo root:
```
NEXT_PUBLIC_SUPABASE_URL=https://gymsbxkuiknbdtulmopv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase MCP>
SUPABASE_SERVICE_ROLE_KEY=<value of THREADOPS_SUPABASE_SECRET_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

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

### Middleware Blocks API Key Auth on API Routes

The middleware in `src/adapters/supabase/auth/proxy.ts` (called from `src/proxy.ts`) redirects unauthenticated requests to `/api/threads/*` and `/api/companies/*` to `/login`. This means:

- **curl requests with X-API-Key header get 307 redirected** before reaching the route handler
- **Browser requests with cookies work fine** because the middleware sees the session cookie

**Workaround for testing:** Temporarily modify `src/adapters/supabase/auth/proxy.ts` to check for `x-api-key` header:
```typescript
const hasApiKey = request.headers.get("x-api-key");
if (isProtectedRoute && !user && !hasApiKey) {
  // redirect to login
}
```
Remember to **revert this change** after testing.

**Note:** The `/api/webhooks/inbound` path is NOT in the protected routes list, so webhook ingestion via curl works without modification.

## Test User

A test user exists for login testing:
- **Email:** `devin-test-agent@threadops.test`
- **Password:** `TestPass123!`
- **Company:** Demo company (`a0000000-0000-0000-0000-000000000001`)

If this user doesn't exist, create via Supabase Auth API:
```bash
curl -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/auth/v1/signup" \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"devin-test-agent@threadops.test","password":"TestPass123!"}'
```
Then add to demo company via psql:
```sql
INSERT INTO company_members (user_id, company_id, role) VALUES ('<user_id>', 'a0000000-0000-0000-0000-000000000001', 'member');
```

## Key URLs and IDs

- **Demo Company ID:** `a0000000-0000-0000-0000-000000000001`
- **Demo Thread ID:** `d0000000-0000-0000-0000-000000000001`
- **Supabase project ref:** `gymsbxkuiknbdtulmopv`
- **Vercel deployment:** `https://threadops-jade.vercel.app/`

## Test Flows

### UI Navigation (Browser)
1. `/login` — Email/password login form
2. `/threads` — Thread list with status and theme tags
3. `/threads/<threadId>` — Thread detail with messages timeline and composer
4. `/api-keys` — API key management with "Create API Key" button
5. `/docs/api` — API documentation with expandable endpoint sections

### Agent Identity Features (PR #12 + #13)
1. **Create API Key form** — Shows hint: "We recommend creating one key per agent...", label: "Label (agent display name)", placeholder: "e.g. Support Bot"
2. **API Keys list** — Each key shows "Posts as: [label]" subtitle
3. **Timeline agent messages** — Purple badge with bot SVG icon + agent name from `author_name`
4. **Timeline user messages** — Muted badge showing "user" (not "You" — fixed in PR #13)
5. **API key auth** — POST to `/api/threads/:threadId/messages` with `X-API-Key` header sets `author_kind: "agent"` and `author_name: <key label>`
6. **Company-scoping** — API key from one company posting to another company's thread returns 403

### Creating Test API Keys via DB (for curl testing)

Since the API key creation endpoint requires cookie auth, create keys directly via psql for curl testing:
```bash
# Generate a hash for a known plaintext key
node -e "
const crypto = require('crypto');
const key = 'to_test_agent_bot_key_for_testing_12345678';
const hash = crypto.createHash('sha256').update(key).digest('hex');
console.log('HASH:', hash);
"

# Insert into DB
PGPASSWORD='<db_password>' psql "<connection_string>" -c "
INSERT INTO api_keys (id, company_id, key_hash, key_prefix, scopes, label)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001',
  'a0000000-0000-0000-0000-000000000001',
  '<hash_from_above>',
  'to_test_',
  ARRAY['threads:read', 'messages:write'],
  'Test Agent Bot'
) ON CONFLICT (id) DO NOTHING;
"
```
The key hash uses SHA-256 (see `src/core/rules/api-key.ts`).

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
**Note:** These endpoints require cookie auth. Use the browser UI or the DB-direct method above.

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
- Cross-company API key → 403 `"Forbidden"`

## Database

Migrations are in `infra/migrations/` (000-010). Seed data is in `infra/seed/seed.sql`.

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

## Cross-Company Security Testing

To test company-scoping, create a second company and thread:
```sql
INSERT INTO companies (id, name, slug) VALUES ('b0000000-0000-0000-0000-000000000002', 'Other Corp', 'other-corp')
ON CONFLICT (id) DO NOTHING;

INSERT INTO threads (id, company_id, title, status, created_by)
VALUES ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Other Company Thread', 'open', '<any_user_id>')
ON CONFLICT (id) DO NOTHING;
```
Then POST to this thread with the demo company's API key — should get 403.

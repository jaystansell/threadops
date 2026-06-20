---
name: testing-threadops
description: Test ThreadOps forum features end-to-end. Use when verifying thread creation, status management, theme filtering, or other forum UI changes.
---

## Overview

ThreadOps is a Next.js 16 forum app with Supabase backend and Tailwind CSS v4. Testing involves running the app locally against the production Supabase database.

## Devin Secrets Needed

- `THREADOPS_SUPABASE_SECRET_KEY` — Supabase secret/service role key (bypasses RLS). Stored as a user-scoped Devin secret. Required for local dev because the app's RLS policies have self-referencing `company_members` queries that cause infinite recursion (PostgreSQL error 42P17) without the service role key.
- The anon key and project URL can be retrieved via the Supabase MCP (`get_publishable_keys` for project `gymsbxkuiknbdtulmopv`).

These should be in `.env.local` at the repo root:
```
NEXT_PUBLIC_SUPABASE_URL=https://gymsbxkuiknbdtulmopv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase MCP>
SUPABASE_SERVICE_ROLE_KEY=<value of THREADOPS_SUPABASE_SECRET_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Local Dev Setup

1. Clone the repo and install dependencies: `npm install`
2. Create `.env.local` with the values shown above.
3. **Important:** Unset any shell-level `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables before starting the dev server. Shell env vars override `.env.local` in Next.js, and your shell may have credentials for a different Supabase project (e.g., ExecReps).
4. Start dev server:
   ```bash
   unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
   NODE_OPTIONS='--dns-result-order=ipv4first' npx next dev --port 3000
   ```
   The `NODE_OPTIONS` flag is needed because Supabase hostnames may resolve to IPv6 addresses, which fail on VMs without IPv6 support. This forces IPv4 resolution.

## Authentication

- A test user exists in the Supabase project for E2E testing. Look up the credentials from the Devin secret `THREADOPS_TEST_USER_EMAIL` and `THREADOPS_TEST_USER_PASSWORD`, or create a new test user via the `/signup` page.
- The test user should be a "member" role in Acme Corp (company_id: `a0000000-0000-0000-0000-000000000001`)
- Login via the `/login` page in the browser

## RLS Policy Considerations

- The `company_members` table has a self-referencing SELECT RLS policy that causes infinite recursion when queried with an auth-aware client (anon key + user JWT). This affects ALL tables because every RLS policy references `company_members` in subqueries.
- The service role key bypasses RLS entirely, which is how the production app works.
- If you encounter PostgreSQL error `42P17` ("infinite recursion detected in policy"), you are missing the service role key.
- Do NOT attempt to use `createAuthServerClient()` for data queries — it will trigger the infinite recursion. The app architecture requires `createServerClient()` (service role) for all data operations.

## Vercel Deployment

- Production URL: `threadops-product-coalition.vercel.app`
- Vercel Deployment Protection may be active, blocking access with 401. If so, either:
  - Ask the user to disable it (Vercel Project Settings > Deployment Protection)
  - Test locally with the service role key (preferred)

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

## Key Test Flows

### Thread Creation
1. Navigate to `/threads`, click "New Thread"
2. Fill form: Title (required), Theme (dropdown), Message (required)
3. Verify "Create Thread" button is disabled when fields empty, enabled when filled
4. Submit and verify redirect to thread detail page with correct title, status, theme badge, and message

### Status Management
1. On thread detail page, verify buttons match status:
   - open: Close + Archive buttons, message composer visible
   - closed: Reopen + Archive buttons, composer hidden
   - archived: NO buttons, NO composer
2. Test full state machine: open -> closed -> open -> archived

### Theme Filtering
1. On `/threads` page, use theme filter dropdown
2. Verify URL updates with `?theme=<id>` parameter
3. Verify only matching threads shown
4. Verify "All themes" resets filter and removes URL param
5. Verify empty state for themes with no threads

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

## Key URLs and IDs

- **Demo Company ID:** `a0000000-0000-0000-0000-000000000001`
- **Demo Thread ID:** `d0000000-0000-0000-0000-000000000001`
- **Supabase project ref:** `gymsbxkuiknbdtulmopv`
- **Vercel deployment:** `https://threadops-jade.vercel.app/`

## Database

- Supabase project ref: `gymsbxkuiknbdtulmopv`
- Seed data: 1 company (Acme Corp), 3 themes (General, Engineering, Product), seed threads and messages
- Use Supabase MCP (`execute_sql`) to inspect data if needed

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

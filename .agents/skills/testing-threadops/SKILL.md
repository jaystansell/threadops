---
name: testing-threadops
description: Test ThreadOps forum features end-to-end. Use when verifying thread creation, status management, theme filtering, file attachments, or other forum UI changes.
---

## Overview

ThreadOps is a Next.js 16 forum app with Supabase backend and Tailwind CSS v4. Testing involves running the app locally against the production Supabase database.

## Devin Secrets Needed

- `THREADOPS_SUPABASE_SECRET_KEY` — Supabase secret/service role key (bypasses RLS). Stored as a user-scoped Devin secret. Required for local dev because the app's RLS policies have self-referencing `company_members` queries that cause infinite recursion (PostgreSQL error 42P17) without the service role key.
- `VERCEL_AUTOMATION_BYPASS_SECRET` — Bypasses Vercel deployment protection for curl testing
- The anon key and project URL can be retrieved via the Supabase MCP (`get_publishable_keys` for project `gymsbxkuiknbdtulmopv`).

These should be in `.env.local` at the repo root:
```
NEXT_PUBLIC_SUPABASE_URL=https://gymsbxkuiknbdtulmopv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase MCP>
SUPABASE_SERVICE_ROLE_KEY=<value of THREADOPS_SUPABASE_SECRET_KEY>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Local Dev Setup

### .env.local Must Exist for Dev Server

The dev server will hang indefinitely on pages that import Supabase (including the root layout's `AuthHeader` component) if `.env.local` is missing. Create it from shell secrets:
```bash
cd /home/ubuntu/repos/threadops
printf "NEXT_PUBLIC_SUPABASE_URL=%s\nNEXT_PUBLIC_SUPABASE_ANON_KEY=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n" \
  "$NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_SERVICE_ROLE_KEY" > .env.local
```

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
- You can also create test users via the Supabase Admin API:
  ```bash
  source .env.local
  curl -s -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "TestPass123!", "email_confirm": true}'
  ```
- New users need to go through onboarding (creates a company + membership). After login they'll be redirected to complete onboarding automatically.

### Login Input Validation Workaround

**IMPORTANT:** The `/login` form may have HTML5 browser validation on the email field that interferes with automated typing. If the email field shows a validation error or refuses input, use the browser console to set the value programmatically:

```javascript
// Set email field value via native input setter (bypasses React controlled component)
const emailInput = document.querySelector('input[type="email"]');
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
nativeInputValueSetter.call(emailInput, 'your-email@example.com');
emailInput.dispatchEvent(new Event('input', { bubbles: true }));

// Do the same for password
const pwInput = document.querySelector('input[type="password"]');
nativeInputValueSetter.call(pwInput, 'YourPassword123!');
pwInput.dispatchEvent(new Event('input', { bubbles: true }));
```

Then click the submit button normally. This workaround is needed when Chrome's autofill or HTML5 validation blocks programmatic typing.

### Signup Auto-Provisioning Gotcha

**IMPORTANT:** When signing up a new user, the system may auto-provision them into one or more companies (via triggers or onboarding logic). The `getUserCompany()` function uses `.limit(1).maybeSingle()` WITHOUT ordering, so it returns whichever company membership appears first in the database — which may NOT be the demo company.

**Symptoms:** After signup and adding the user to the demo company (`a0000000-...`), threads sidebar shows "No threads found" even though threads exist for that company.

**Fix:** After signup, query `company_members` for the user and DELETE any auto-provisioned memberships that are NOT the demo company:
```bash
# Check all memberships
curl -s "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/company_members?user_id=eq.<USER_ID>" \
  -H "apikey: ${THREADOPS_SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${THREADOPS_SUPABASE_SECRET_KEY}"

# Delete non-demo memberships
curl -s -X DELETE "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/company_members?id=eq.<MEMBERSHIP_ID>" \
  -H "apikey: ${THREADOPS_SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${THREADOPS_SUPABASE_SECRET_KEY}"
```

Alternatively, use the "Join Demo Company" button on the `/onboarding` page which sets up the membership correctly. But still check for extra memberships.

## RLS Policy Considerations

- The `company_members` table has a self-referencing SELECT RLS policy that causes infinite recursion when queried with an auth-aware client (anon key + user JWT). This affects ALL tables because every RLS policy references `company_members` in subqueries.
- The service role key bypasses RLS entirely, which is how the production app works.
- If you encounter PostgreSQL error `42P17` ("infinite recursion detected in policy"), you are missing the service role key.
- Do NOT attempt to use `createAuthServerClient()` for data queries — it will trigger the infinite recursion. The app architecture requires `createServerClient()` (service role) for all data operations.

## Supabase Database Access Limitations

- **Supabase MCP is read-only for DDL**: `apply_migration` and `execute_sql` cannot run CREATE TABLE, ALTER TABLE, or other DDL statements. They work for SELECT/INSERT/UPDATE/DELETE.
- **Direct DB host is IPv6-only**: `db.gymsbxkuiknbdtulmopv.supabase.co` resolves to an IPv6 address only. psql connections will fail with "Network is unreachable" from VMs without IPv6.
- **Pooler connection requires DB password**: The service role key is NOT the database password. Pooler connections (`aws-0-us-east-1.pooler.supabase.com`) require the actual DB password set during project creation.
- **Workaround for DDL**: Ask the user to run migrations via the Supabase Dashboard SQL Editor, or provide the actual DB password.
- **Supabase REST API works for data**: You can create/read/update data via the REST API with the service role key (e.g., creating storage buckets, inserting rows).

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

### Chrome May Crash During Testing

If the default Chrome (managed via CDP at localhost:29229) crashes, you can restart Chrome manually:
```bash
DISPLAY=:0 /opt/.devin/chrome/chrome/linux-133.0.6943.126/chrome-linux64/chrome \
  --no-first-run --disable-session-crashed-bubble --no-sandbox --disable-gpu \
  --user-data-dir=/home/ubuntu/.chrome-profile \
  --remote-debugging-port=29229 \
  http://localhost:3000 &>/dev/null &
```
Then maximize with: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`

### Vercel Deployment Protection Bypass

Preview and production deployments may have Vercel SSO protection enabled. To test deployed URLs via curl:
```bash
curl -H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}" "https://threadzy.ai/..."
```
Browser access to Vercel previews requires Vercel SSO login, so prefer testing against local dev server for UI testing.

### Mobile Viewport Testing Limitation

The VM display is 1600x1200. Browser window resizing via `xdotool` or `wmctrl` may not affect the actual rendered viewport width (Chrome's content area). Tailwind responsive breakpoints (sm=640px, lg=1024px) cannot be easily tested visually. Verify responsive classes exist in HTML instead:
- `sm:hidden` for mobile-only elements
- `hidden lg:block` for desktop-only sidebar

### CSS Hover Testing Limitation

The CDP `mouse_move` action may NOT trigger CSS `:hover` pseudo-class consistently. This means `group-hover:*` Tailwind utilities won't become visible during automated testing. Workarounds:
1. **Verify via DOM inspection**: Check that the button has correct classes (`hidden group-hover:md:flex`)
2. **Force visibility via JS**: `document.querySelectorAll('[aria-label="..."]')[n].style.display = 'flex'`
3. **Click via JS**: `btn.click()` — note that `window.confirm()` blocks JS execution so the CDP call will timeout (this is expected behavior)
4. **Check for dialog**: After JS click times out, take a screenshot to see the browser's native confirm dialog

### Testing Against Production vs Local

**Recommended: Test against production (https://threadzy.ai)**
- Production is publicly accessible (no Vercel auth wall)
- Vercel **preview** URLs are protected by Vercel Authentication and require team login - don't use them for testing
- Production has real data and correct Supabase connection

**Signup flow for production testing:**
1. Navigate to `https://threadzy.ai/signup`
2. Sign up with any email + password (min 6 chars). Email confirmation is **disabled** - session is created immediately
3. After signup, you'll be redirected to `/onboarding` with a "Join Demo Company" button
4. Click "Join Demo Company" to get access to threads, webhooks, API keys
5. You now have full authenticated access as a "member" role user

**Note on .env.local:** The repo's `.env.local` may point to a different Supabase project (e.g. `sdqnfhdorrlbjyssokqs`) that has **no tables**. This is not useful for local testing unless you apply all migrations first. The production Vercel deployment uses the correct project (`gymsbxkuiknbdtulmopv`).

## Key Test Flows

### ACK Timeout & Auto-Escalation (PR #175)

The ACK timeout feature marks threads as "unhandled" if agents don't acknowledge within a configurable timeout. Key components:

**Files:**
- `src/app/api/cron/check-ack-timeouts/route.ts` — Cron endpoint (runs every minute)
- `src/app/_components/redispatch-button.tsx` — Client component for retry button
- `src/app/api/threads/[threadId]/redispatch/route.ts` — Redispatch API endpoint
- `src/app/threads/[threadId]/page.tsx` — Thread detail with unhandled banner
- `src/app/_components/thread-sidebar.tsx` — Sidebar with amber/blue dot indicators

**Migration dependency:** `infra/migrations/037_add_ack_timeout_to_webhook_endpoints.sql` adds `ack_timeout_seconds` column to `webhook_endpoints`. The cron endpoint will return 500 if this migration hasn't been applied.

**UI indicators:**
- **Amber pulsing dot** (`bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.7)]`) = unhandled thread
- **Blue pulsing dot** (`bg-blue-500 animate-pulse`) = agent processing/acknowledged thread
- Both dots appear in the sidebar next to thread names

**Thread detail banner:** When `agent_processing_status = 'unhandled'`, shows:
- Amber-bordered banner with "Agent unresponsive" text
- "Last delivery attempt: <formatted date>" from most recent webhook delivery
- "Retry delivery" button (RedispatchButton client component)

**Testing the cron endpoint (shell):**
```bash
# Without auth — expect 401
curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/cron/check-ack-timeouts

# With auth — expect 200 (or 500 if migration not applied)
curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/cron/check-ack-timeouts \
  -H "Authorization: Bearer ${CRON_SECRET}"

# GET also supported (Vercel cron compatibility)
curl -s -w "\n%{http_code}" http://localhost:3000/api/cron/check-ack-timeouts \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

**Testing the redispatch button (browser):**
1. Navigate to a thread with `agent_processing_status = 'unhandled'`
2. Verify the amber banner appears below the thread title
3. Click "Retry delivery" → observe "Retrying…" loading state
4. On success: button shows "Dispatched!", page auto-refreshes, banner disappears
5. On error: button shows "Failed — retry?" (clickable again)

**Setting up test data for unhandled threads:**
```sql
-- Insert an unhandled status record for testing
INSERT INTO agent_processing_status (thread_id, company_id, status, updated_at)
VALUES ('<thread_id>', 'a0000000-0000-0000-0000-000000000001', 'unhandled', NOW())
ON CONFLICT (thread_id) DO UPDATE SET status = 'unhandled', updated_at = NOW();
```

**Verifying redispatch cleared status (shell via Supabase MCP):**
```sql
SELECT * FROM agent_processing_status WHERE thread_id = '<thread_id>';
-- Should return empty after successful redispatch
```

**Known issues:**
- The cron endpoint queries `webhook_endpoints.ack_timeout_seconds` which requires migration 037 to be applied. Without it, the endpoint returns 500 even with valid auth.
- The redispatch endpoint requires cookie auth (user must be logged in via browser). It verifies thread ownership via `getUserCompany()`.
- RedispatchButton uses `fetch()` + `router.refresh()` pattern — no full page reload, just React Server Component re-render.

### Thread Creation
1. Navigate to `/threads`, click "New Thread"
2. Fill form: Title (required), Theme (dropdown), Message (required)
3. Verify "Create Thread" button is disabled when fields empty, enabled when filled
4. Submit and verify redirect to thread detail page with correct title, status, theme badge, and message

### Status Management
1. On thread detail page, verify the inline action bar buttons match status:
   - open: Archive (amber) + Generate Tags + Generate Summary buttons in one row, message composer visible
   - archived: Reopen (emerald) + Generate Tags + Generate Summary buttons in one row
2. Test Archive -> Reopen cycle: click Archive redirects to /threads, switch to Archived filter, click thread, verify Reopen button, click Reopen restores Archive button
3. The action bar is rendered by `ThreadActionsPanel` component (`src/app/_components/thread-actions-panel.tsx`)
4. Generate Tags/Summary buttons fire API calls to `/api/threads/{id}/actions` and enter a polling state ("Tags Requested" / "Summary Requested" with spinner). They re-enable after polling completes via `onPollComplete` callback.

### Theme Filtering
1. On `/threads` page, use theme filter dropdown
2. Verify URL updates with `?theme=<id>` parameter
3. Verify only matching threads shown
4. Verify "All themes" resets filter and removes URL param
5. Verify empty state for themes with no threads

### Delete Messages (PR #71)
1. Navigate to a thread with messages
2. **Desktop**: Trash icon button appears on hover over message card (positioned absolute top-2 right-2, `hidden group-hover:md:flex`)
3. **Mobile**: Ellipsis (⋯) button always visible (`md:hidden`), opens dropdown with red "Delete" option
4. Clicking delete triggers `window.confirm("Are you sure you want to delete this message? This cannot be undone.")`
5. Confirming removes the message immediately (optimistic UI via `deletedIds` state)
6. If API call fails, message is restored and an alert is shown (rollback)
7. Deletion is a hard delete from the `messages` table
8. After page refresh, deleted message stays gone (persisted in DB)

**Testing approach for delete:**
- Use JS to make the button visible (CDP hover limitation)
- Click via `btn.click()` — JS will timeout due to `window.confirm()` blocking
- Screenshot to see the confirm dialog
- Click OK/Cancel on the dialog via computer tool coordinates
- Verify message count changes (or stays the same for cancel)
- Verify with DB query that deletion persisted

### File Attachments (PR #72)

**Prerequisites:**
- The `message_attachments` table must exist in the database. If not, run `infra/migrations/023_create_message_attachments.sql` via Supabase Dashboard SQL Editor.
- The `thread-attachments` storage bucket must exist. Create via REST API if needed:
  ```bash
  source .env.local
  curl -s -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/storage/v1/bucket" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"id": "thread-attachments", "name": "thread-attachments", "public": false}'
  ```

**Key files:**
- Message composer: `src/app/_components/message-composer.tsx` (file picker, drag-drop, paste, previews)
- Attachment display: `src/app/_components/message-attachments.tsx` (timeline rendering)
- Validation: `src/core/types/attachment.ts` (MIME types, blocked extensions, size limits)
- Upload API: `src/app/api/threads/[threadId]/messages/[messageId]/attachments/route.ts`
- Download API: `src/app/api/threads/[threadId]/messages/[messageId]/attachments/[attachmentId]/download/route.ts`

**UI Testing (works without DB table):**
1. **File picker**: Click "Attach" button (paperclip icon) next to "Send Message" to open file dialog
2. **File preview chips**: Selected files show as chips with thumbnail/icon, filename, size, × remove button
3. **Image previews**: PNG/JPG files show blob URL thumbnail; text files show 📝 icon; PDFs show 📄 icon
4. **Blocked types**: `.sh`, `.exe`, `.bat` etc. show red error chip with "File type .XX is not allowed"
5. **Max files**: 5-file cap enforced — Attach button disabled at 5/5, info text shows "5/5 files · Max 10 MB each"
6. **File removal**: × button removes file chip, Send button re-disables when no valid files remain
7. **Send with files**: Creates message, attempts upload (fails without DB table), shows red error count

**Using Playwright for file input** (the file input is `display:none`):
```javascript
const { chromium } = require('playwright');
const browser = await chromium.connectOverCDP('http://localhost:29229');
const page = browser.contexts()[0].pages()[0];
await page.locator('input[type="file"]').setInputFiles('/path/to/file.png');
// To remove: await page.locator('button[aria-label="Remove filename.png"]').click();
```

**Full upload flow (requires DB table):**
1. Attach valid file + type message → click Send
2. Message appears in timeline with attachment count badge
3. Click download link → signed URL with Content-Disposition header
4. Purge cron: POST `/api/cron/purge-files` with `Authorization: Bearer <CRON_SECRET>`

### UI Navigation (Browser)
1. `/login` — Email/password login form
2. `/threads` — Thread list with status and theme tags
3. `/threads/<threadId>` — Thread detail with messages timeline and composer
4. `/api-keys` — API key management with "Create API Key" button
5. `/docs/api` — API documentation with expandable endpoint sections

### API Documentation Page (`/docs/api`)
1. Navigate to `/docs/api` — page should render without auth redirect (it's public)
2. Verify endpoint sections are expandable/collapsible
3. Verify request/response examples are shown

### Search
1. Type query in search bar on `/threads` and click "Search"
2. URL updates to `?q=<query>` (server-side filtering)
3. Only matching threads shown (case-insensitive `ilike`)
4. Empty results show "No threads matching '<query>'" message
5. Clearing search shows all threads again

### Pagination
- Page size is 10 items
- Previous/Next buttons only appear when total > 10
- URL param: `?page=2`

### Sign Out
1. Click "Sign out" in header
2. Redirects to `/login`
3. Protected routes redirect back to `/login` when unauthenticated

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

### API Key Auth on Thread Routes (curl)

API key auth works on `/api/threads` and `/api/threads/[id]/messages` (and webhooks). It does NOT work on `/api/companies/*` routes (those require cookie auth).

To create a test API key for curl testing, insert directly via Supabase REST API (the `/api/companies/*/api-keys` route requires cookie auth):
```bash
# Generate key + hash
KEY_DATA=$(node -e "const c=require('crypto');const p='to_'+c.randomBytes(32).toString('hex');const h=c.createHash('sha256').update(p).digest('hex');console.log(JSON.stringify({plaintext:p,hash:h,prefix:p.substring(0,7)}))")
echo "$KEY_DATA"

# Insert via Supabase REST API (service role key bypasses RLS)
source .env.local
curl -s -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/api_keys" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"company_id\":\"a0000000-0000-0000-0000-000000000001\",\"label\":\"TestBot\",\"key_hash\":$(echo $KEY_DATA | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["hash"]))'),\"key_prefix\":$(echo $KEY_DATA | python3 -c 'import sys,json;print(json.dumps(json.load(sys.stdin)["prefix"]))'),\"scopes\":[\"threads:read\",\"threads:write\",\"messages:read\",\"messages:write\"]}"
```

Test the key works:
```bash
# Should return 200 with threads JSON (NOT 307 redirect)
curl -s -w "\n%{http_code}" -H "X-API-Key: <plaintext_key>" http://localhost:3000/api/threads

# Should return 201 with author_kind:"agent", author_name matching key label
curl -s -X POST -H "X-API-Key: <plaintext_key>" -H "Content-Type: application/json" \
  -d '{"body":"Test message"}' http://localhost:3000/api/threads/d0000000-0000-0000-0000-000000000001/messages

# Invalid key should return 401, NOT fallthrough to cookie auth
curl -s -w "\n%{http_code}" -H "X-API-Key: to_invalid" http://localhost:3000/api/threads
```

**Important:** The proxy matches `/api/threads` (no trailing slash) via `.startsWith()`. If this is changed to include a trailing slash, requests to `GET /api/threads` and `POST /api/threads` will be redirected to `/login` even with a valid API key.

### Error Handling
- Missing `x-api-key` header on protected route -> 307 redirect to `/login`
- Invalid API key on `/api/threads` -> 401 `"Invalid API key"`
- Invalid API key on `/api/webhooks/inbound` -> 401 `"Invalid API key"`
- Empty message body -> 400 `"body is required and must be a string"`
- Invalid scopes (e.g. `["admin:delete"]`) -> 400 `"Invalid scopes provided"`
- Cross-company API key -> 403 `"Forbidden"`

## PR #40 Features (Thread Detail Enhancements)

### Sort Order Toggle
- Thread detail view has a sort toggle button (right-aligned, above messages)
- Default: "Oldest first" (chronological), click toggles to "Newest first"
- Composer position changes: bottom for oldest-first, top for newest-first
- Preference persisted in localStorage via `ThreadDetailClient` wrapper component
- File: `src/app/_components/thread-detail-client.tsx`

### Delivery Confirmation Indicator
- Below each message body: green checkmark SVG + "Delivered via API" or "Delivered via browser" + relative time
- Uses `author_kind` field: "agent" = API, "user" = browser
- Helper functions `relativeTime()` and `deliveryMethod()` in thread-timeline.tsx
- File: `src/app/_components/thread-timeline.tsx` (lines ~13-29 and ~143-161)

### Webhook Log-Style UI
- `/webhooks` page uses monospace "webhook.log" header, dark bg (#0a0e14)
- Column headers: timestamp, status, event, payload
- Status icons: checkmark (ok), X (failed), circle (pending)
- 50 items per page with pagination
- File: `src/app/webhooks/page.tsx`

### Public Changelog
- `/changelog` is a public page (no auth required)
- Timeline UI with version entries from `src/app/changelog/releases.ts`
- File: `src/app/changelog/page.tsx`

### Getting-Started Banner
- Shows on `/api-keys` page when `!hasKeys` (no active API keys)
- Won't be visible if demo company has active keys
- File: `src/app/api-keys/page.tsx` (lines 29-37)

### Sidebar Active Thread Contrast
- Active thread uses `accent/15` background for readability in dark mode
- File: `src/app/_components/thread-sidebar.tsx`

### Markdown Line Breaks
- `remark-breaks` plugin added to react-markdown so single `\n` renders as `<br>`
- Fixes agent messages that use single newlines between sections
- File: `src/app/_components/thread-timeline.tsx`

### Summary/Tags and Action Bar (PR #73)
- Thread detail shows `ThreadActionsPanel` which renders ThreadTags (tag badges only, button hidden) and ThreadSummaryEditor (summary text only, button hidden) alongside three inline action buttons
- The action buttons (Archive, Generate Tags, Generate Summary) are consolidated in a single flex row via `ThreadActionsPanel`
- `ThreadMetadata` component is NOT rendered on the page (import and usage removed in PR #73, file still exists)
- ThreadTags and ThreadSummaryEditor accept `hideButton`, `generateTrigger`, and `onPollComplete` props for external button control
- Files: `src/app/_components/thread-actions-panel.tsx` (new), `thread-summary-editor.tsx`, `thread-tags.tsx`

### Creating Test Threads for Action Bar Testing
To test the action bar, you need a thread with an agent. The flow is:
1. Create an API key on `/api-keys` page (this creates an agent)
2. Create a thread on `/threads/new` — select the agent from the dropdown
3. Navigate to the thread detail page to see the inline action bar

### Stickman Micro-Animations (PR #95)

Three CSS/SVG stickman animations exist in the app:

1. **Empty state idle** (`StickmanEmptyState`) — Teal stickman with wandering eyes + bobbing `?` on `/threads` when no thread is selected. File: `src/app/threads/page.tsx`, `src/app/threads/[threadId]/not-found.tsx`
2. **Message send** (`StickmanSendAnimation`) — Stickman sprints with envelope after clicking "Send Message" (800ms). File: `src/app/_components/message-composer.tsx`
3. **Archive sweep** (`StickmanArchiveAnimation`) — Stickman sweeps with broom on archive (700ms delay before redirect). File: `src/app/_components/thread-actions-panel.tsx`

**Testing fast CSS animations (< 1 second):**
- Screenshots alone may miss animations that complete in < 1 second. Use Playwright CDP to detect DOM changes:
  ```javascript
  const { chromium } = require('playwright');
  const browser = await chromium.connectOverCDP('http://localhost:29229');
  const page = browser.contexts()[0].pages()[0];
  
  // Set up watcher BEFORE triggering the action
  const animPromise = page.waitForSelector('.stickman-send', { timeout: 5000 });
  await page.click('button:has-text("Send Message")');
  const found = await animPromise; // Confirms element appeared in DOM
  
  // Verify auto-removal after animation completes
  await new Promise(r => setTimeout(r, 1000));
  const stillInDom = await page.$('.stickman-send');
  console.log('Auto-removed:', !stillInDom);
  ```
- For the archive animation, also verify button disabled state:
  ```javascript
  const sweepPromise = page.waitForSelector('.stickman-sweep', { timeout: 5000 });
  await page.click('button:has-text("Archive")');
  await sweepPromise;
  const btn = await page.$('button:has-text("...")');
  const isDisabled = await btn.isDisabled(); // Should be true during animation
  ```

**Key CSS classes to watch for:**
- `.stickman-send` — send runner SVG (appears ~800ms)
- `.stickman-sweep` — archive broom SVG (appears ~700ms)
- `.stickman-idle` — empty state SVG (persistent)

### Testing Agent Group Reorder (PR #107+)

Agent groups are per-user (RLS on `user_id = auth.uid()`). When testing group features, the test user may have no groups even if Jay's account does. Create groups via the "Manage Groups" modal (accessible from "By group" dropdown in sidebar).

**Reorder test flow:**
1. Switch sidebar to "By group" view via dropdown
2. Click "Manage Groups" to open the modal
3. Create 3+ groups (needed to test boundary conditions)
4. Verify first group's UP arrow is disabled, last group's DOWN arrow is disabled
5. Click DOWN on a group — it should swap with the one below
6. Save and verify DB: `curl -s "...agent_groups?select=name,sort_order&order=sort_order" ...`
7. After testing, delete all test groups to clean up

**sort_order normalization test:**
- Delete a group from the middle, add a new group, then verify DB has sequential sort_order values with no gaps or duplicates
- Without the fix (pre-PR #107 Devin Review), deleting from the middle would leave gaps and new groups could collide

### Testing Sidebar Scroll Independence (PR #108+)

The sidebar and main pane should scroll independently. To test:
1. Switch to "By agent" view
2. Expand an agent accordion with many threads (e.g., FYG REPTAR has 22+)
3. Scroll the sidebar down until threads near the bottom are visible
4. Click a thread near the bottom of the scrolled list
5. **Verify:** sidebar stays at the same scroll position, main pane loads the thread
6. Scroll the main pane — verify sidebar doesn't move

The fix uses `max-h-[calc(100dvh-3.25rem)]` on the threads layout container. If the header height changes significantly, this value may need adjustment.

### Stale Session Cookies Cause Extreme Middleware Latency

**CRITICAL:** If Chrome has stale/expired Supabase session cookies, the `supabase.auth.getClaims()` call in `src/adapters/supabase/auth/proxy.ts` (line 35) can hang for **100+ seconds** per request. This affects ALL routes (not just protected ones) because `getClaims()` runs before the route check.

**Symptoms:** Dev server logs show `GET /threads 200 in 108s (application-code: 108s)` — the `application-code` time is 100+ seconds.

**Fix:** Use a **fresh Chrome profile** (no stale cookies). If you restart Chrome with `--user-data-dir=/home/ubuntu/.chrome-profile-fresh`, the requests complete in 3-5 seconds.

**Login vs Signup:** The login server action may hang if the middleware is slow. Signup tends to work because it creates a fresh session without needing to validate an existing one. If login hangs, try signing up a new user instead.

## Key URLs and IDs

- **Demo Company ID:** `a0000000-0000-0000-0000-000000000001`
- **Demo Thread ID:** `d0000000-0000-0000-0000-000000000001`
- **Supabase project ref:** `gymsbxkuiknbdtulmopv`
- **Vercel deployment:** `https://threadzy.ai/`

## Database

- Supabase project ref: `gymsbxkuiknbdtulmopv`
- Seed data: 1 company (Acme Corp), 3 themes (General, Engineering, Product), seed threads and messages
- Use Supabase MCP (`execute_sql`) to inspect data if needed

Migrations are in `infra/migrations/` (000-0357). Seed data is in `infra/seed/seed.sql`.

To apply migrations via psql (pooler connection, bypasses IPv6 issue):
```bash
export DBURL="postgres://postgres.gymsbxkuiknbdtulmopv:<password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
for f in infra/migrations/*.sql; do psql "$DBURL" -f "$f"; done
psql "$DBURL" -f infra/seed/seed.sql
```

The Supabase MCP tool's `execute_sql` is read-only for DDL (CREATE TABLE, ALTER TABLE, etc.). For DDL operations, use the Supabase Dashboard SQL Editor or the psql pooler connection above.

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


## Savings Calculator and White Paper Testing

The savings calculator (`src/app/_components/savings-calculator.tsx`) appears on both the homepage (`/`) and the white paper page (`/white-paper`, Section 9). Both should render identically.

### Calculator Default Values
- 3 agents, 20 threads/day, 2 interactions, Standard tier ($9/MTok), Platform summarization baseline, 30 min/day human time
- Expected Combined Value cards: Gross $820.45, Plan $75.00 (3 x $25), Net $745.45, Net annual $8.9K

### Key Things to Test
1. **4 Combined Value cards present**: Gross monthly savings, Threadzy plan cost, Net monthly ROI, Net annual ROI
2. **Plan cost scales with agents**: `agents x $25/mo`. Change slider to verify (e.g., 10 agents = $250)
3. **Negative net ROI edge case**: Set agents high (50), threads low (1). Plan cost ($1,250/mo) should exceed gross savings. Verify negative values display as `-$X.XX` or `-$X.XK` (sign before dollar sign), NOT `$-X.XX`
4. **White paper Section 8**: Contains "Plans start at $25/agent/month" text and 3 scenario cards (Solo, Small team, Scaling) each showing plan cost deduction line items
5. **Calculator consistency**: White paper Section 9 calculator should match homepage calculator exactly (same cards, same defaults, same values)

### Calculator Slider Interaction Tips
- Sliders are `<input type="range">` elements. Use the number input next to each slider for precise values (triple-click to select, then type new value)
- The "Human time saved" slider controls human time savings. It does NOT scale with agent count (intentional: one manager's time is bounded)
- The "Compare against" dropdown toggles between Platform summarization (~10K tokens) and Raw replay baselines

### formatDollars Function
The `formatDollars` function in `savings-calculator.tsx` handles display formatting:
- Values >= 1000 display as `$X.XK` (e.g., $8.9K)
- Negative values prepend `-` before `$` (e.g., `-$478.15`, `-$5.7K`)
- If negative values ever show as `$-X.XX`, that is a bug in the formatDollars function

### White Paper Structure
The white paper (`/white-paper`) has 9 sections:
1. The Human Problem
2. The Agent Problem
3. How Threadzy Solves Both
4. Who Benefits Most
5. Human Time Savings
6. Token Savings Model
7. Information Fidelity
8. ROI Summary (pricing copy and scenario cards)
9. Interactive Calculator (same component as homepage)

Test against production (`https://threadzy.ai`) since no auth is required for the calculator or white paper pages.

### Attachment Webhook Testing (PR #96)

The `attachment.created` webhook fires when a user uploads a file to a thread message. It delivers a signed download URL to the owning agent's webhook endpoint.

**Key behavior:**
- `attachment.created` is an ALWAYS_ON event — delivered to all active endpoints regardless of their stored `events` array
- Echo suppression: if the uploader IS the agent (API key auth), the agent's own endpoint is excluded
- Agent-scoped delivery: only the thread's owning agent receives the webhook (via `agent_api_key_id` on the thread)

**Test setup:**
1. Create a test API key via Supabase REST API (generate key with `crypto.createHash('sha256')`, insert into `api_keys`)
2. Register a webhook endpoint for that key: `POST /api/webhook-endpoints` with `x-api-key` header
3. Create a thread owned by the test agent: `POST /api/threads` with `x-api-key` header and `{"title":"...", "message_body":"..."}`
4. To test the human→agent flow, log in as a human user in the browser and upload a file to the agent's thread

**Testing the webhook payload:**
```bash
# Query webhook_deliveries for attachment.created events
source .env.local
curl -s "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/webhook_deliveries?event_type=eq.attachment.created&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -m json.tool
```

**Expected payload fields:**
- `attachment_id` (UUID), `message_id` (UUID), `thread_id` (UUID)
- `filename` (string), `content_type` (string), `file_size` (int > 0)
- `download_url` (signed Supabase Storage URL, valid 1 hour)

**Verify the download URL works:**
```bash
# Extract download_url from payload, then:
curl -s -o /tmp/downloaded.txt -w "%{http_code}" "${DOWNLOAD_URL}"
# Should return 200 with original file content
```

**Echo suppression test:**
- Upload a file AS the agent (via `x-api-key`) → zero `webhook_deliveries` rows (agent doesn't webhook itself)
- Upload a file AS a human (cookie auth) to the same thread → 1 `webhook_deliveries` row delivered to the agent's endpoint

**Common gotcha:** If testing via Playwright, the script must be in the repo directory (not `/tmp/`) to resolve the `playwright` package from `node_modules`. Use `chromium.connectOverCDP('http://localhost:29229')` and `context.newPage()` (not `context.pages()[0]` which may be closed).

**Vercel preview gotcha:** Preview deployments may have Vercel SSO protection enabled, redirecting to Vercel login. Test against localhost for UI-based upload tests.

### Webhook Isolation / Agent Cross-Bleed Testing (PR #111+)

The webhook delivery system scopes events to the thread-owning agent's endpoint. Testing webhook isolation is shell-only (no browser needed).

**Key concepts:**
- `agent_api_key_id` on the `threads` table determines which agent owns a thread
- `outbound-webhook.ts` filters endpoints: only the owning agent's endpoint receives events
- Echo suppression: the posting agent never gets its own webhook
- Unowned threads (`agent_api_key_id = NULL`) only fire to legacy endpoints (`api_key_id = NULL`)
- Auto-assign: when an agent posts in an unowned thread, it claims ownership

**Test API key:** `to_test_agent_bot_key_for_testing_12345678` (id: `aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001`). This key may be revoked — unrevoke it via:
```bash
source .env.local
curl -s -X PATCH "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/api_keys?id=eq.aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"revoked_at": null}'
```

**Test flow for cross-agent blocking:**
```bash
# Post as Test Agent Bot to another agent's thread — should get 403
curl -s -X POST "http://localhost:3000/api/threads/<FYG_JET_THREAD_ID>/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: to_test_agent_bot_key_for_testing_12345678" \
  -d '{"body":"test"}' 
# Expected: {"error":"This thread belongs to another agent"}
```

**Test flow for auto-assign ownership:**
1. Create a thread with `agent_api_key_id = NULL` via Supabase REST API
2. Post a message as Test Agent Bot via `/api/threads/{id}/messages`
3. Query the thread — `agent_api_key_id` should now be `aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001`

**Test flow for webhook scoping:**
1. Record `webhook_deliveries` count (baseline)
2. Post a message as Test Agent Bot to its own thread
3. Wait 5s, check count again
4. Expected: 0 new deliveries (echo suppression blocks self, ownership filter blocks others)
5. Compare to old code behavior: unowned threads generated 8+ deliveries per message (broadcast to all)

**Known agent endpoint IDs (may change):**
- FYG Jet: `c952b98b-ddeb-40cc-b455-69dcde71f977`
- Tasklet ProdCo: `bbbb38c4-b0da-40ee-a68b-5660fccbe1a9`
- ExecReps Agent: `31319ded-5df4-4917-8316-54e69c42e5c5`

**Cleanup after testing:** Re-revoke the test API key, delete any test threads/messages created during testing.

**Debugging agent not responding:**
- If webhooks show `status=succeeded` but the agent doesn't respond, the issue is on the agent platform side (e.g., Tasklet), not Threadzy
- Check `webhook_endpoints` table to confirm the agent has an active endpoint registered
- Check `webhook_deliveries` to confirm deliveries are being created for the thread
- The `webhook_deliveries` table does NOT have an `endpoint_id` column — you cannot directly see which endpoint received a delivery

### Webhook Context Enrichment Testing (PR #136+)

Outbound webhooks include a `context` object with thread metadata when `include_context` is true (default). Testing is shell-only (no browser needed).

**Key concepts:**
- `fetchThreadContext()` in `outbound-webhook.ts` runs 4 parallel queries: thread data, recent messages (last 5), message count, and thread_tags
- Context is added to the webhook envelope as a top-level `context` key alongside `event`, `payload`, and `timestamp`
- `include_context` column on `webhook_endpoints` table (boolean, default true) controls opt-out
- Graceful degradation: if context fetch fails, webhook sends without the `context` field
- Message bodies in `recent_messages` are truncated to 500 chars max
- Tags come from the `thread_tags` table (separate table, not jsonb on threads)

**Context object structure:**
```json
{
  "thread_summary": "string | null",
  "thread_tags": ["tag1", "tag2"],
  "thread_status": "open",
  "thread_title": "Thread title",
  "recent_messages": [
    {"body": "...", "author_kind": "agent", "author_name": "Bot", "created_at": "..."}
  ],
  "message_count": 15,
  "reply_endpoint": "POST /api/threads/{thread_id}/messages",
  "ack_endpoint": "POST /api/threads/{thread_id}/ack"
}
```

**Testing approach — Integration test (recommended):**

The `after()` function may not fire reliably in local Turbopack dev mode (Next.js 16). To test context-fetching logic, write a Node.js `.mjs` script that directly calls the same Supabase queries `fetchThreadContext` uses:
```bash
source .env.local
# Script imports @supabase/supabase-js, creates client with service role key,
# runs the 4 parallel queries against a test thread, and asserts on output
node test-webhook-context.mjs
```

**Testing `include_context` API validation:**
```bash
# POST with string "false" — should return 400: "include_context must be a boolean"
# POST with boolean false — should succeed (201)
# PATCH with number 0 — should return 400: "include_context must be a boolean"
# PATCH with boolean false/true — should succeed and toggle the value
```

**Important: Agent-scoped delivery affects webhook testing:**
- Threads with `agent_api_key_id = NULL` only deliver to endpoints with `api_key_id = NULL` (legacy)
- Agent-owned threads only deliver to the owning agent's endpoint
- To test webhook delivery, create "legacy" endpoints (insert via Supabase REST with `api_key_id: null`)
- OR set thread's `agent_api_key_id` to match endpoint's `api_key_id`, post from a different agent
- Echo suppression always excludes the posting agent from receiving its own webhook
- The `webhook_deliveries` table stores only the raw `eventPayload`, NOT the enriched envelope with context

**Full e2e on production (requires public URL):**
1. Expose a local port (`deploy expose`) to get a public URL
2. Register a legacy webhook endpoint (api_key_id: null) with that URL
3. Post a message via production to an unowned thread
4. Verify captured payload includes the `context` object

### Agent Feedback Dashboard Testing (PR #119)

The feedback dashboard (`/feedback`) is admin-only — restricted to `jay+direct@productcoalition.com`. Testing requires both API (curl) and browser interactions.

**Admin user setup:**
- User `jay+direct@productcoalition.com` (id: `df7456a7-5775-4a54-8536-33b8206c7beb`) exists in the Supabase auth system
- To set a known password for testing:
  ```bash
  curl -s -X PUT "https://gymsbxkuiknbdtulmopv.supabase.co/auth/v1/admin/users/df7456a7-5775-4a54-8536-33b8206c7beb" \
    -H "apikey: $THREADOPS_SUPABASE_SECRET_KEY" \
    -H "Authorization: Bearer $THREADOPS_SUPABASE_SECRET_KEY" \
    -H "Content-Type: application/json" \
    -d '{"password": "TestAdmin123!"}'
  ```
- This user is a member of Acme Corp (`a0000000-0000-0000-0000-000000000001`)

**Middleware note:** `/api/feedback` and `/feedback` are NOT in the middleware's protected routes list (only `/threads`, `/onboarding`, `/api/threads`, `/api/companies` are protected). This means:
- `POST /api/feedback` and `GET /api/feedback` work via curl with `x-api-key` header without middleware blocking
- `/feedback` page protection is handled by the server component itself (checks email, redirects to `/threads`)

**Test flow:**
1. Create a test API key via Supabase REST API (see "Creating Test API Keys via DB" section above)
2. Submit feedback via curl:
   ```bash
   curl -s -X POST "https://threadzy.ai/api/feedback" \
     -H "Content-Type: application/json" \
     -H "x-api-key: <plaintext_key>" \
     -d '{"category":"api_feature","title":"Test feedback item","description":"Test description","priority":"high"}'
   ```
   Expected: 201 with JSON containing `status: "pending"`, correct `company_id` and `api_key_id`
3. Log in as admin in browser, navigate to `/feedback`
4. Verify: "Feedback" nav link visible (7th item), dashboard shows submitted item with correct title/badges
5. Test HITL flow: type notes → click Approve → verify status badge changes, notes appear, buttons swap to "Mark Shipped"
6. Click "Mark Shipped" → verify terminal state (no action buttons)
7. Sign out, log in as non-admin user → verify no "Feedback" nav link, `/feedback` URL redirects to `/threads`

**Key assertions:**
- Admin nav has 7 links (including Feedback); non-admin has 6 (no Feedback)
- Status transitions: pending → approved → shipped (with admin notes persisted)
- Non-admin redirect: `/feedback` → `/threads` (server-side redirect)
- Tab counts update correctly after each status change

**Cleanup:** Delete test feedback rows and test API keys after testing. Delete any test users created for non-admin testing via the Supabase Admin API.

### Revoked Agent Webhook Isolation (PR #120+)

Revoking an API key should cascade to deactivate all webhook endpoints tied to that key, AND the dispatch logic should skip endpoints whose key has `revoked_at` set.

**Revoke cascade test flow:**
1. Find or create an API key with an active webhook endpoint
2. Call revoke: `PATCH /api/companies/{companyId}/api-keys/{keyId}/revoke`
3. Query `webhook_endpoints` for that key — all should have `active=false`
4. The revoke route adds `.eq("company_id", companyId)` for defensive scoping

**Backfill verification (production):**
```bash
# Get all revoked keys
source .env.local
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/api_keys?revoked_at=not.is.null&select=id,label" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# For each key, verify 0 active endpoints
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/webhook_endpoints?api_key_id=eq.<KEY_ID>&active=eq.true&select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**Unit tests:** 23 tests in `src/adapters/supabase/__tests__/outbound-webhook-filters.test.ts` cover echo suppression, cross-agent isolation, revoked agent filtering, multi-company isolation, and combined scenarios. Run with:
```bash
npx vitest run src/adapters/supabase/__tests__/outbound-webhook-filters.test.ts
```

### Sidebar View Persistence (PR #118+)

The sidebar groupBy ("agent", "group", "timeline") and status filter ("open", "archived", "all") persist in localStorage across page refreshes and client-side navigations.

**localStorage keys:**
- `threadops-group-by` — stores "agent", "group", or "timeline"
- `threadops-status-filter` — stores "open", "archived", or "all"

**Browser test flow:**
1. Navigate to `/threads`, change groupBy to "By group" via dropdown
2. Hard refresh (Ctrl+Shift+R) — dropdown should still show "By group"
3. Verify in devtools console: `localStorage.getItem("threadops-group-by")` === `"group"`
4. Change status to "Archived", hard refresh — dropdown should still show "Archived" AND thread list should show archived threads
5. Navigate away (e.g., to `/webhooks`) and back to `/threads` — verify archived threads still shown (mount fetch reconciliation)

**Mount fetch reconciliation gotcha:** The thread list fetches data on mount. If the persisted status differs from the server default ("open"), the mount fetch must use the persisted value. Without the fix (commit `07a1199`), the dropdown shows "Archived" but the thread list briefly shows open threads before correcting. The fix defers the mount fetch via `useEffect` so localStorage is read first.

**Disconnected agent indicators (PR #115/117):**
- Revoked agents show "Disconnected" badge (red) in sidebar with 50% opacity and strikethrough name
- Thread detail shows red banner: "This agent has been disconnected..."
- Composer shows amber warning for revoked agent threads (still usable, but warns replies won't reach agent)
- Check both "By agent" and "By group" sidebar views for consistent badge rendering

### Agent Processing Status (PR #135)

The agent processing status feature lets agents report their webhook processing state (acknowledged, processing, completed, escalated) so humans see real-time indicators in the thread timeline.

**Key files:**
- `src/app/api/threads/[threadId]/ack/route.ts` — POST endpoint for agents
- `src/app/api/threads/[threadId]/status/route.ts` — GET endpoint for polling
- `src/app/_components/agent-processing-status.tsx` — UI component (polls every 10s)
- `src/app/_components/thread-timeline.tsx` — integrates AgentProcessingStatus component
- `infra/migrations/032_create_agent_processing_status.sql` — creates the table + RLS

**Migration dependency:** The `agent_processing_status` table must exist in the database for the full E2E flow to work. Without it, POST /ack returns 500 (passes all validation but fails on insert) and GET /status returns `{"status":null,"updated_at":null,"agent_name":null}`.

**Graceful degradation:** The UI component does NOT crash when the table is missing. It silently handles the null response and shows nothing. The existing "Awaiting response" indicator continues working independently.

**Testing the API endpoints (curl):**
```bash
THREAD_ID="9bdb9c76-63ca-44d5-b51d-306a52c12c8d"
API_KEY="to_4540b50447ec1c2ac3a1633d68127ef19b8c84d2b9c7b606662efc22b39854aa"

# Auth validation
curl -s http://localhost:3000/api/threads/$THREAD_ID/ack -X POST \
  -H "Content-Type: application/json" -d '{"status":"acknowledged"}'
# Expected: 401 "API key required"

# Body validation
curl -s http://localhost:3000/api/threads/$THREAD_ID/ack -X POST \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"status":"invalid"}'
# Expected: 400 "status must be one of: acknowledged, processing, completed, escalated"

# GET status (null response when no data or table missing)
curl -s http://localhost:3000/api/threads/$THREAD_ID/status \
  -H "X-API-Key: $API_KEY"
# Expected: 200 {"status":null,"updated_at":null,"agent_name":null}
```

**Testing UI polling (browser):**
1. Navigate to a thread in "awaiting response" state (last message from user)
2. Open DevTools Network tab, filter for "status"
3. Verify GET requests to `/api/threads/{id}/status` appear every ~10 seconds
4. The polling only activates when the thread is awaiting a response

**Full E2E flow (requires migration applied):**
1. POST `/api/threads/{id}/ack` with `{"status":"processing"}` using API key
2. GET `/api/threads/{id}/status` returns `{"status":"processing","updated_at":"...","agent_name":"<key label>"}`
3. In browser, thread shows blue "Agent is working on this..." indicator with spinning animation
4. POST with `{"status":"completed"}` hides the indicator on next poll cycle (~10s)

**Middleware note:** The proxy in `src/adapters/supabase/auth/proxy.ts` already bypasses auth for API key routes on `/api/threads/*` (lines 51-54 check for `x-api-key` header). Both `/ack` and `/status` routes work with API key auth without modification.

**Status enum:** Only these 4 values are accepted: `acknowledged`, `processing`, `completed`, `escalated`. Any other value returns 400.

**Thread ownership validation:** The thread must belong to the same company as the API key. Cross-company requests return 404 "Thread not found".

### ACK Timeout / Unhandled Thread Detection (PR #166)

The ACK timeout feature adds automatic detection of threads where an agent failed to acknowledge a webhook delivery within the configured timeout window. It extends the `agent_processing_status` system with "unhandled" status and adds visual indicators.

**Key files:**
- `src/app/api/cron/check-unhandled/route.ts` — Cron endpoint that detects unhandled threads
- `src/app/_components/thread-sidebar.tsx` — Amber indicator (lines ~1068-1094)
- `src/app/threads/[threadId]/page.tsx` — Amber banner + "Unhandled" badge
- `infra/migrations/035_add_ack_timeout_to_companies.sql` — Adds `ack_timeout_seconds` column
- `vercel.json` — Cron schedule (every minute)

**Migration dependency:** The cron endpoint requires `companies.ack_timeout_seconds` column. Without migration 035 applied, it returns `{"error":"column companies.ack_timeout_seconds does not exist"}`. The UI indicators work independently of this migration (they read from `agent_processing_status` table which exists from migration 032).

**Testing the UI indicators:**

The UI reads `agent_processing_status` per-thread from the threads layout query. To test indicators without running the cron, insert records directly:
```bash
source .env.local
# Insert "unhandled" status for a thread
curl -s -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/agent_processing_status" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"thread_id":"<THREAD_ID>","api_key_id":"<API_KEY_ID>","status":"unhandled"}'

# Insert "acknowledged" status for comparison
curl -s -X POST "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/agent_processing_status" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"thread_id":"<THREAD_ID>","api_key_id":"<API_KEY_ID>","status":"acknowledged"}'
```

**Visual indicator differences:**
- **Unhandled (amber):** `bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.7)]` with title="Unhandled — agent did not acknowledge"
- **Acknowledged/Processing (blue):** `bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.7)]` with title="Agent processing"
- Sidebar shows a small pulsing dot next to thread title
- Thread detail shows amber banner with text: "Agent has not acknowledged this message within the configured timeout window."
- Thread detail shows amber "Unhandled" badge: `bg-amber-500/15 text-amber-400`
- Acknowledged threads show blue "Agent acknowledged" badge: `bg-blue-500/15 text-blue-400` and NO amber banner

**Testing the cron endpoint:**
```bash
# Set CRON_SECRET before starting dev server
export CRON_SECRET=test-secret
npm run dev

# Test auth (should pass with correct bearer token)
curl -s -X GET "http://localhost:3000/api/cron/check-unhandled" \
  -H "Authorization: Bearer test-secret"

# Without CRON_SECRET or wrong token: returns 401 "Unauthorized"
```

**Environment variable gotcha:** Shell-level `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` variables may persist from other repos (e.g., ExecReps) and override `.env.local`. Always `unset` these before starting the dev server:
```bash
unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export CRON_SECRET=test-secret
npm run dev
```

**Test user setup for UI verification:**
1. Sign up a new user via `/signup` (email + password, min 6 chars)
2. Complete onboarding via "Join Demo Company" button
3. If user ends up in wrong company, update via REST API:
   ```bash
   curl -s -X PATCH "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/company_members?user_id=eq.<USER_ID>" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"company_id": "a0000000-0000-0000-0000-000000000001"}'
   ```

**Cleanup:** After testing, delete the test `agent_processing_status` rows:
```bash
curl -s -X DELETE "https://gymsbxkuiknbdtulmopv.supabase.co/rest/v1/agent_processing_status?thread_id=eq.<THREAD_ID>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### Delivery Receipts Testing (PR #173)

The delivery receipt component (`MessageDeliveryReceipt`) shows a collapsible 4-stage pipeline below each user message: Webhook Fired → HTTP Response → Agent ACK → Agent Reply.

**Key files:**
- `src/app/_components/message-delivery-receipt.tsx` — React component (compact + expanded views)
- `src/app/api/threads/[threadId]/messages/[messageId]/delivery/route.ts` — API endpoint
- `src/app/_components/thread-timeline.tsx` — integrates `MessageDeliveryReceipt` for user messages only

**API endpoint:** `GET /api/threads/:threadId/messages/:messageId/delivery`
- Returns: `{ stages: DeliveryStage[], overall_status, webhook, ack, reply }`
- `overall_status` enum: "delivered" | "acknowledged" | "replied" | "pending" | "failed"
- `stages` always has exactly 4 items with `label`, `status`, `timestamp`, `detail`
- Stage `status` values: "complete" | "pending" | "failed" | "inactive"
- Graceful fallback: works without migration 037 columns (uses `payload->>message_id` lookup)

**Test data locations:**
- Thread with successful deliveries: `dc9a8b2e-41b6-4491-98ce-511e3f3a44d3` ("Andrea Bronzini — EP104 Promotion Gap")
  - Message `be65d6d3-e07c-4fd1-bf5c-803492c2f5f4` — HTTP 200, overall "delivered"
- Thread with failed + replied: `4c0e4d5f-8c9d-471c-841c-212efabf0b16` ("Outreach & Customer Monitoring")
  - Message `20f91365-efea-4846-a32c-206874e44aa2` — HTTP 405 failure but agent replied (overall "replied")

**Browser test flow:**
1. Navigate to thread with deliveries, scroll to find user messages
2. Verify compact receipt below user messages: `📤 → ✓200 → ⏳ → ○` (or similar pipeline)
3. Verify color coding: amber text for "delivered", green for "replied"
4. Click receipt to expand — verify 4 progress dots, 4 detail rows with timestamps
5. Verify agent messages do NOT show delivery receipts
6. Click again to collapse — verify returns to single-line compact view

**API test via browser console (requires authenticated session):**
```javascript
fetch('/api/threads/dc9a8b2e-41b6-4491-98ce-511e3f3a44d3/messages/be65d6d3-e07c-4fd1-bf5c-803492c2f5f4/delivery')
  .then(r => r.json()).then(d => console.log(JSON.stringify(d)))
```

**Data constraint:** Demo company has NO purely "failed" overall_status — all failed webhook deliveries have subsequent agent replies, making overall "replied". This means:
- Cannot test red compact view color coding
- Cannot test retry button visibility (only shows when `overall_status === "failed"`)
- To test these, you would need to insert a synthetic webhook_delivery with no corresponding agent reply

**Retry button logic:** Only renders when `data.overall_status === "failed"` AND `data.webhook` exists. Calls `POST /api/webhook-deliveries/:delivery_id/retry` then refreshes receipt data.

## Testing localStorage-Persisted UI State

Several sidebar features persist state to localStorage. When testing these:

1. **Clear the key first** to test default behavior: `localStorage.removeItem('threadops-hide-disconnected')`
2. **Verify both states** — toggle ON then refresh, toggle OFF then refresh
3. **Use DOM counting** to verify filtering works: `document.querySelectorAll('aside a[href^="/threads/"]').length`
4. **Check localStorage value** matches UI state: `localStorage.getItem('threadops-hide-disconnected')`

Known localStorage keys:
- `threadops-hide-disconnected` — "true"/"false", defaults to "true" (ON)
- `threadops-sidebar-groupBy` — "agent"/"group"/"timeline"
- `threadops-sidebar-status` — "open"/"archived"/"all"
- `threadops-sidebar-width` — pixel width (200-480)

### Hide Disconnected Agents Toggle

- Only appears when `revokedAgentNames.size > 0` (at least one agent has ALL keys revoked)
- Filters across all 3 grouping modes: "By agent" (hides accordion groups), "By group" (hides subgroups, removes empty parent groups), "By timeline" (hides threads by agent_name)
- **"By group" mode requires custom groups** to be configured via "Manage Groups" button — without groups, there's nothing to filter
- Revoked agents show a red "Disconnected" badge when visible
- Currently ~15 revoked agents in Demo Company with ~21 open threads

## Seed Data for Testing

When creating test data via the service role key, note these schema requirements:
- `threads` table requires: `company_id`, `title`, `status`, `created_by` (user UUID)
- `messages` table requires: `thread_id`, `author_id` (user UUID), `author_kind`, `body` (no `company_id` column)
- `message_attachments` table requires: `message_id`, `thread_id`, `company_id`, `filename`, `file_size`, `content_type`, `storage_path`

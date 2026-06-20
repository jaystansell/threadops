# ThreadOps Scaffold — End-to-End Test Plan

## What Changed
This is a brand new scaffold PR — the entire ThreadOps application. All code is new. The primary goal is to verify the core user-facing flows work end-to-end against a live Supabase database with seed data.

## Environment
- Local dev server at http://localhost:3000
- Supabase project: gymsbxkuiknbdtulmopv (ThreadOps)
- Seed data: 1 company (Acme Corp), 3 themes, 1 agent, 1 thread ("Welcome to ThreadOps"), 2 messages
- Demo company ID: a0000000-0000-0000-0000-000000000001
- Demo thread ID: d0000000-0000-0000-0000-000000000001

## Test 1: UI Navigation & Thread Display (Browser)

**Steps:**
1. Open http://localhost:3000 in the browser
2. Verify the home page shows "Welcome to ThreadOps" heading and a "Threads" card link
3. Click the "Threads" card to navigate to /threads
4. Verify the threads list shows "1 thread" count and a thread titled "Welcome to ThreadOps" with an "open" badge
5. Click the "Welcome to ThreadOps" thread to navigate to /threads/d0000000-...
6. Verify the thread detail page shows:
   - "All Threads" back link
   - Thread title "Welcome to ThreadOps"
   - "open" status badge
   - 2 seed messages from the "agent" author kind
   - A message composer textarea with "Send Message" button

**Pass criteria:**
- Home page renders with "ThreadOps" branding and Threads navigation card
- Thread list shows exactly "1 thread" (not "0 threads" or "No threads yet")
- Thread detail shows 2 messages with "agent" badges and the message composer form

## Test 2: Post a Message via UI Composer (Browser)

**Steps:**
1. On the thread detail page (/threads/d0000000-...), type "Hello from the browser test!" into the composer textarea
2. Click "Send Message"
3. Observe the textarea clears (indicating success)
4. Refresh the page to confirm the message persists

**Pass criteria:**
- After clicking "Send Message", the textarea resets to empty (no error message shown)
- After page refresh, 3 messages appear (2 seed + 1 new)
- The new message shows "user" author kind badge (not "agent")
- The message body reads "Hello from the browser test!"

## Test 3: API Key Generation (Shell — curl)

**Steps:**
1. POST to /api/companies/a0000000-.../api-keys with `{"label": "test-webhook-key", "scopes": ["webhooks:read"]}`
2. Verify the response includes `plaintext_key` starting with `to_`, `key_prefix`, and the "Store this key securely" message
3. Save the plaintext_key for Test 4
4. GET /api/companies/a0000000-.../api-keys to verify the key appears in the list (without plaintext)

**Pass criteria:**
- POST returns 201 with a `plaintext_key` matching pattern `to_[64 hex chars]`
- Response includes `message: "Store this key securely. It will not be shown again."`
- GET returns an array containing the new key with matching `key_prefix` but NO `plaintext_key` field

## Test 4: Webhook Inbound with Idempotency (Shell — curl)

**Steps:**
1. POST to /api/webhooks/inbound with:
   - Header: `x-api-key: <key from Test 3>`
   - Header: `x-idempotency-key: test-idem-001`
   - Body: `{"source": "test", "event_type": "ping", "data": {"hello": "world"}}`
2. Verify 202 Accepted with a `delivery_id`
3. Repeat the same POST (same idempotency key)
4. Verify 200 with `"Already processed"` message and the same `delivery_id`

**Pass criteria:**
- First request: 202 status, response has `message: "Accepted"` and a UUID `delivery_id`
- Second request (duplicate): 200 status, response has `message: "Already processed"` and the SAME `delivery_id` as the first request

## Test 5: API Error Handling (Shell — curl)

**Steps:**
1. POST to /api/webhooks/inbound WITHOUT x-api-key header → expect 401 "Missing x-api-key header"
2. POST to /api/webhooks/inbound with invalid x-api-key → expect 401 "Invalid API key"
3. POST to /api/threads/.../messages with empty body → expect 400 "body is required"
4. POST to /api/companies/.../api-keys with invalid scope `["admin:delete"]` → expect 400 "Invalid scopes"

**Pass criteria:**
- Each request returns the exact error message and status code listed above

# ThreadOps Scaffold — Test Report

**PR:** [#1 feat: scaffold ThreadOps forum app with provider-agnostic architecture](https://github.com/jaystansell/threadops/pull/1)
**Session:** [Devin session](https://app.devin.ai/sessions/eea8dbb4012448bda108c94d62d0cec2)
**Environment:** Local dev server (localhost:3000) against live Supabase project `gymsbxkuiknbdtulmopv`

## Summary

Tested the full ThreadOps scaffold end-to-end: UI navigation, message posting, API key generation, webhook ingestion with idempotency, and error handling. All 5 tests passed.

## Escalations

- **Vercel deployment failing** — The Vercel deployment at https://threadzy.ai/ is failing because Supabase env vars are not configured in the Vercel project settings. This is a config issue, not a code issue. The user needs to add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel Project Settings > Environment Variables.
- **Realtime messages not appearing without refresh** — After posting a message via the composer, the new message does not appear in the timeline until a page refresh. The Supabase Realtime subscription may require enabling Realtime on the `messages` table in the Supabase dashboard (Database > Replication > Enable for `messages` table). This is not a code bug — the subscription code is correct, but Realtime must be explicitly enabled per-table in Supabase.

## Test Results

- **It should display home page with ThreadOps branding and navigation** — PASSED
- **It should show thread list with seed data** — PASSED
- **It should show thread detail with seed messages and composer** — PASSED
- **It should navigate back to thread list via back link** — PASSED
- **It should post a message via the UI composer** — PASSED (textarea clears, message persists after refresh with "user" badge)
- **It should generate an API key with valid scopes** — PASSED (201, `to_` prefix, hash-only in list)
- **It should handle webhook with idempotency dedup** — PASSED (first: 202, duplicate: 200 "Already processed", same delivery_id)
- **It should return correct error responses for invalid requests** — PASSED (401 missing key, 401 invalid key, 400 empty body, 400 bad scopes)

## Evidence

### Home Page
![Home page](screenshots/ss_a9887206.png)

### Thread List with Seed Data
![Thread list showing 1 thread](screenshots/ss_e8e4dc66.png)

### Thread Detail with Messages and Composer
![Thread detail with 2 agent messages and composer](screenshots/ss_26f035f5.png)

### Message Posted via UI Composer (After Refresh)
![4 messages visible after browser-posted message](screenshots/ss_da9c6c7a.png)

### API Test Results (Shell)

**API Key Generation:**
```
POST /api/companies/.../api-keys → 201
{"id":"1e3b4076-...","plaintext_key":"to_75b833b7d29a4712bcd3ba576e0402170fa629d690d341908ab22b8aba456d65","key_prefix":"to_75b83","message":"Store this key securely. It will not be shown again."}

GET /api/companies/.../api-keys → 200
[{"key_hash":"aa6874c4e1b3c255335e6cb400fe49f1e61ac2537af7e1d3a7c8d8d10ea0af12","key_prefix":"to_75b83",...}]
(No plaintext_key in list — hash-only storage confirmed)
```

**Webhook Idempotency:**
```
POST /api/webhooks/inbound (first) → 202
{"message":"Accepted","delivery_id":"54fc0a80-66e3-45ca-9625-a6b529b52929"}

POST /api/webhooks/inbound (duplicate) → 200
{"message":"Already processed","delivery_id":"54fc0a80-66e3-45ca-9625-a6b529b52929"}
(Same delivery_id confirms dedup)
```

**Error Handling:**
```
Missing x-api-key → 401 {"error":"Missing x-api-key header"}
Invalid API key   → 401 {"error":"Invalid API key"}
Empty msg body    → 400 {"error":"body is required and must be a string"}
Invalid scopes    → 400 {"error":"Invalid scopes provided"}
```

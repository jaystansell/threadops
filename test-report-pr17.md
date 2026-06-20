# Test Report: PR #17 — API Key Auth on All Thread Routes

## Summary
Tested all API key auth changes via curl against localhost dev server with latest PR #17 code. **All 7 tests passed.**

## Test Results

| # | Test | Expected | Actual | Result |
|---|------|----------|--------|--------|
| 1 | `GET /api/threads` with valid API key | 200 + threads JSON | 200 + `{"threads":[...], "total":...}` | PASSED |
| 2 | `GET /api/threads` with **invalid** API key | 401 `"Invalid API key"` | 401 `{"error":"Invalid API key"}` | PASSED |
| 3 | `GET /api/threads` with **no** auth | 307 redirect to /login | 307 | PASSED |
| 4 | `POST /api/threads` with valid key creates thread | 201 + thread JSON | 201 + `{"id":"e9da...","title":"Agent Thread Verify","company_id":"a000..."}` | PASSED |
| 5 | `POST /api/threads` with **invalid** key | 401 `"Invalid API key"` | 401 `{"error":"Invalid API key"}` | PASSED |
| 6 | `POST /api/threads/[id]/messages` with valid key | 201 + agent attribution | 201 + `{"author_kind":"agent","author_name":"TestBot"}` | PASSED |
| 7 | `/api/companies` with API key (should NOT bypass) | 307 redirect | 307 | PASSED |

## Key Verifications

### Proxy bypass fix works (Test 1 vs old behavior)
- **Before PR #17:** `GET /api/threads` with `X-API-Key` header returned 307 redirect (proxy checked `/api/threads/` with trailing slash, didn't match `/api/threads`)
- **After PR #17:** Returns 200 with thread list JSON

### Invalid key returns 401, not fallthrough (Test 2)
- Invalid API key on `GET /api/threads` returns `401 {"error":"Invalid API key"}`
- Does NOT silently fall through to cookie auth (which would return 307)
- Discriminated union (`none`/`invalid`/`ok`) correctly distinguishes "no header" from "bad header"

### Agent identity preserved (Tests 4, 6)
- Thread created via API key has `created_by` matching the key's database ID (`76232f0e-...`)
- Message posted via API key has `author_kind: "agent"` and `author_name: "TestBot"` (key label)

### Company routes remain protected (Test 7)
- `/api/companies/*/api-keys` with `X-API-Key` header still returns 307
- API key bypass is correctly scoped to `/api/threads` and `/api/webhooks/inbound` only

## Environment
- Dev server: `http://127.0.0.1:3000` (Next.js 16.2.9 Turbopack)
- API key: `to_3d06...` (label: "TestBot", company: `a0000000-...`)
- Branch: `devin/1781979064-fix-api-key-routes`

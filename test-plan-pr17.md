# Test Plan: PR #17 — API Key Auth on All Thread Routes

## What Changed
- Proxy bypass path: `/api/threads/` (trailing slash) → `/api/threads` (no trailing slash)
- GET/POST `/api/threads` now accept `X-API-Key` header (dual auth: API key or cookie)
- PATCH `/api/threads/[id]/status` now accepts `X-API-Key` and derives company from key
- Invalid API key returns 401 immediately (discriminated union), not silent fallthrough to cookie auth

## Test Environment
- Dev server: `http://127.0.0.1:3000`
- Valid API key: `to_3d0678fca3bac2825d6744c6b76d70eeb18e5ef8abcd3b69fb837b3264c76d69`
- Company: `a0000000-0000-0000-0000-000000000001`
- Thread: `d0000000-0000-0000-0000-000000000001`

## Test Cases

### Test 1: GET /api/threads with valid API key returns thread list (not 307)
**Steps:** `curl -H "X-API-Key: <valid_key>" http://127.0.0.1:3000/api/threads`
**Pass:** HTTP 200 with JSON body containing `threads` array and `total` count
**Fail:** HTTP 307 (redirect to /login) or any non-200 status

### Test 2: GET /api/threads with invalid API key returns 401 (not fallthrough)
**Steps:** `curl -H "X-API-Key: to_invalid_fake_key" http://127.0.0.1:3000/api/threads`
**Pass:** HTTP 401 with body `{"error": "Invalid API key"}`
**Fail:** HTTP 307 (redirect) or HTTP 200 (fell through to cookie auth)

### Test 3: GET /api/threads without any auth returns 307 redirect
**Steps:** `curl http://127.0.0.1:3000/api/threads` (no headers)
**Pass:** HTTP 307 redirect to /login
**Fail:** Any other status code

### Test 4: POST /api/threads with valid API key creates thread as agent
**Steps:** `curl -X POST -H "X-API-Key: <valid_key>" -H "Content-Type: application/json" -d '{"title":"Agent Thread","message_body":"Hello from agent"}' http://127.0.0.1:3000/api/threads`
**Pass:** HTTP 201 with JSON body containing `id`, `title: "Agent Thread"`, `created_by` matching key ID
**Fail:** HTTP 307 (redirect), 401, or 500

### Test 5: POST /api/threads with invalid API key returns 401
**Steps:** `curl -X POST -H "X-API-Key: to_bad_key" -H "Content-Type: application/json" -d '{"title":"test","message_body":"test"}' http://127.0.0.1:3000/api/threads`
**Pass:** HTTP 401 with `{"error": "Invalid API key"}`
**Fail:** Any other status

### Test 6: POST /api/threads/[id]/messages with valid API key (existing behavior still works)
**Steps:** `curl -X POST -H "X-API-Key: <valid_key>" -H "Content-Type: application/json" -d '{"body":"Agent message"}' http://127.0.0.1:3000/api/threads/d0000000-0000-0000-0000-000000000001/messages`
**Pass:** HTTP 201 with `author_kind: "agent"` and `author_name: "TestBot"`
**Fail:** 307, 401, or missing agent attribution

### Test 7: /api/companies route with API key is still protected (307)
**Steps:** `curl -H "X-API-Key: <valid_key>" http://127.0.0.1:3000/api/companies/a0000000-0000-0000-0000-000000000001/api-keys`
**Pass:** HTTP 307 redirect to /login (API key bypass does NOT apply to /api/companies)
**Fail:** HTTP 200 or any non-redirect response

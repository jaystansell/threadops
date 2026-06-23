---
name: testing-threadops-auth
description: Test ThreadOps authentication flows end-to-end. Use when verifying login, signup, onboarding, sign-out, route protection, and API auth.
---

# Testing ThreadOps Auth

## Devin Secrets Needed

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL for ThreadOps (`gymsbxkuiknbdtulmopv`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key for ThreadOps
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key for ThreadOps

**Important**: The org-level Devin secrets may point to a different Supabase project (e.g. ExecReps/`sdqnfhdorrlbjyssokqs`). Verify the `NEXT_PUBLIC_SUPABASE_URL` env var matches `gymsbxkuiknbdtulmopv` before testing. If mismatched, you can still test auth UI (login/signup pages, proxy redirects, sign-out) but NOT data-dependent flows (onboarding, threads, messages).

## Prerequisites

1. Clone the repo and run `npm install`
2. Copy `.env.example` to `.env.local` and fill in correct Supabase credentials
3. Start the dev server: `npm run dev` (runs on port 3000)

## Creating Test Users

The signup endpoint may be rate-limited on the Supabase project. To bypass rate limits, create users via the Admin API:

```bash
curl -X POST "https://${NEXT_PUBLIC_SUPABASE_URL#https://}/auth/v1/admin/users" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test-user@example.com", "password": "TestPass123!", "email_confirm": true}'
```

This creates a verified user immediately, bypassing email confirmation and rate limits.

## Test Plan

### 1. Route Protection (unauthenticated)
- Navigate to `/threads` without auth
- **Expected**: Redirect to `/login`
- Also test: Direct API call to `POST /api/threads/{id}/messages` without auth returns 307 redirect

### 2. Login Error Handling
- Enter invalid email/password on `/login`
- **Expected**: Red error text "Invalid login credentials", stay on `/login`

### 3. Login → Redirect Flow
- Log in with valid test user credentials
- **Expected**: Redirect to `/threads` → `/onboarding` (if user has no company membership)
- Auth header should show user email and "Sign out" button

### 4. Onboarding Flow (requires correct Supabase project)
- On `/onboarding`, click "Join Demo Company"
- **Expected**: User inserted into `company_members`, redirect to `/threads`
- Threads list should show seed data (e.g. "Welcome to ThreadOps")

### 5. Thread Detail + Message Posting (requires correct Supabase project)
- Click a thread from the list
- Type a message and click "Send Message"
- **Expected**: Message appears in timeline, `author_id` matches authenticated user ID

### 6. Sign Out
- Click "Sign out" in header
- **Expected**: Redirect to `/login`, auth header clears
- Navigate to `/threads` → should redirect to `/login` (session destroyed)

### 7. Authenticated User Redirect
- While logged in, navigate to `/login`
- **Expected**: Proxy redirects to `/threads` (or `/onboarding`)

### 8. OAuth Consent Page (authorization_code flow)
- Navigate to `/oauth/authorize?response_type=code&client_id=test-app&redirect_uri=http://localhost:9999/callback&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&scope=threads:read+threads:write&state=test123`
- **Expected**: Page shows "Authorize Application", client_id, requested scopes, and a list of user's active (non-revoked) API keys as radio buttons
- Select an API key → "Authorize" button becomes enabled
- Click "Deny" → redirects to `redirect_uri?error=access_denied&error_description=...&state=test123`
- Click "Authorize" → generates authorization code and redirects to `redirect_uri?code=...&state=test123` (requires `oauth_authorization_codes` table to exist)

### 9. OAuth Consent Page — Validation Errors
- Navigate to `/oauth/authorize?response_type=invalid&client_id=test&redirect_uri=http://localhost/cb&code_challenge=abc`
- **Expected**: Shows "Authorization Error" with "Invalid request: response_type must be 'code'"
- Missing required params (client_id, redirect_uri, code_challenge) also show validation errors

### 10. OAuth Login Redirect with ?next= Parameter
- While signed out, navigate to `/oauth/authorize?response_type=code&client_id=test&...`
- **Expected**: Redirects to `/login?next=%2Foauth%2Fauthorize%3F...` with all OAuth params encoded in the `next` parameter
- After logging in, should redirect back to `/oauth/authorize` with all OAuth params preserved (NOT to `/threads`)

## Known Issues / Workarounds

- **Vercel Deployment Protection**: The Vercel preview may be SSO-protected. If testing against the deployed version, you might need the team owner to temporarily disable Deployment Protection in Vercel project settings (Settings → Deployment Protection → toggle off).
- **Supabase email rate limits**: Use the Admin API approach above to create test users instead of the signup form.
- **Wrong Supabase credentials**: If the env vars point to a different project, auth pages (login, signup, sign-out, proxy redirects) still work because they only need the Supabase Auth API. Data-dependent pages (threads, onboarding "Join") will fail with "No company found" or similar errors.
- **Email confirmation**: The signup page handles both cases: if email confirmation is disabled, it redirects immediately; if enabled, it shows "Check your email" UI. Use Admin API with `email_confirm: true` to bypass.
- **Shell env vars may conflict**: The org-level Devin secrets may set `NEXT_PUBLIC_SUPABASE_URL` etc. pointing to the wrong Supabase project. Before starting the dev server, run `unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY` so the `.env.local` file values are used instead.
- **OAuth authorization_code flow requires migration**: The full code exchange flow (POST /api/oauth/authorize → code → POST /api/oauth/token) requires the `oauth_authorization_codes` and `oauth_access_tokens` tables to exist. Check if migration `infra/migrations/033_oauth_authorization_codes.sql` has been applied. Without it, the consent page UI still renders but clicking "Authorize" will fail at the DB insert step.
- **Supabase MCP is read-only for DDL**: You cannot create tables via `apply_migration` or `execute_sql` on the Supabase MCP — both fail with read-only errors. Migrations must be applied manually via the Supabase Dashboard SQL Editor.

## Cleanup

After testing, delete test users via Supabase dashboard or Admin API to keep the project clean:

```bash
curl -X DELETE "https://${NEXT_PUBLIC_SUPABASE_URL#https://}/auth/v1/admin/users/{USER_ID}" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

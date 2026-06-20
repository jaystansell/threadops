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

## Known Issues / Workarounds

- **Vercel Deployment Protection**: The Vercel preview may be SSO-protected. If testing against the deployed version, you might need the team owner to temporarily disable Deployment Protection in Vercel project settings (Settings → Deployment Protection → toggle off).
- **Supabase email rate limits**: Use the Admin API approach above to create test users instead of the signup form.
- **Wrong Supabase credentials**: If the env vars point to a different project, auth pages (login, signup, sign-out, proxy redirects) still work because they only need the Supabase Auth API. Data-dependent pages (threads, onboarding "Join") will fail with "No company found" or similar errors.
- **Email confirmation**: The signup page handles both cases: if email confirmation is disabled, it redirects immediately; if enabled, it shows "Check your email" UI. Use Admin API with `email_confirm: true` to bypass.

## Cleanup

After testing, delete test users via Supabase dashboard or Admin API to keep the project clean:

```bash
curl -X DELETE "https://${NEXT_PUBLIC_SUPABASE_URL#https://}/auth/v1/admin/users/{USER_ID}" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

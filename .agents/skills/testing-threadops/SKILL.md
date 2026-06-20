---
name: testing-threadops
description: Test ThreadOps forum features end-to-end. Use when verifying thread creation, status management, theme filtering, or other forum UI changes.
---

## Overview

ThreadOps is a Next.js 16 forum app with Supabase backend and Tailwind CSS v4. Testing involves running the app locally against the production Supabase database.

## Devin Secrets Needed

- `THREADOPS_SUPABASE_SERVICE_ROLE_KEY` (repo-scoped) — Required for local dev. The app's RLS policies have self-referencing `company_members` queries that cause infinite recursion (PostgreSQL error 42P17) without the service role key. ALL data queries go through `company_members` RLS policies, so the anon key alone is insufficient for local testing.

## Local Dev Setup

1. Clone the repo and install dependencies: `npm install`
2. Create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://gymsbxkuiknbdtulmopv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase>
   SUPABASE_SERVICE_ROLE_KEY=<service role key - REQUIRED>
   ```
3. **Important:** Unset any shell-level `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` environment variables before starting the dev server. Shell env vars override `.env.local` in Next.js, and your shell may have credentials for a different Supabase project (e.g., ExecReps).
4. Start dev server: `unset NEXT_PUBLIC_SUPABASE_URL && unset NEXT_PUBLIC_SUPABASE_ANON_KEY && unset SUPABASE_SERVICE_ROLE_KEY && npx next dev --port 3000`

## Authentication

- Test user: `devin-test-20260620@mailinator.com` / `TestPass123!`
- This user is a "member" role in Acme Corp (company_id: `a0000000-0000-0000-0000-000000000001`)
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

## Database

- Supabase project ref: `gymsbxkuiknbdtulmopv`
- Seed data: 1 company (Acme Corp), 3 themes (General, Engineering, Product), seed threads and messages
- Use Supabase MCP (`execute_sql`) to inspect data if needed

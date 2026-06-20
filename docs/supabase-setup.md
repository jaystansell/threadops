# Supabase Setup

## 1. Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Choose a name (e.g. `threadops`) and set a database password.
3. Wait for the project to finish provisioning.

## 2. Get Your Credentials

From **Project Settings > API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret) |

Add these to your `.env.local` file.

## 3. Apply Migrations

Run the migration files in order via the **SQL Editor** in the Supabase Dashboard, or use the Supabase CLI:

```bash
# Install the Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run each migration in order
psql $DATABASE_URL -f infra/migrations/001_create_companies.sql
psql $DATABASE_URL -f infra/migrations/002_create_themes.sql
psql $DATABASE_URL -f infra/migrations/003_create_threads.sql
psql $DATABASE_URL -f infra/migrations/004_create_messages.sql
psql $DATABASE_URL -f infra/migrations/005_create_agents.sql
psql $DATABASE_URL -f infra/migrations/006_create_api_keys.sql
psql $DATABASE_URL -f infra/migrations/007_create_webhook_deliveries.sql
```

Or copy-paste each `.sql` file into the Supabase Dashboard SQL Editor and run them in sequence.

## 4. Enable Realtime

Messages use Supabase Realtime for live updates. Migration `004` adds the `messages` table to the `supabase_realtime` publication. Verify this is active in **Database > Replication** in the dashboard.

## 5. Row Level Security

All tables have RLS enabled with policies that scope reads/writes to company members via `auth.uid()`. The service role key bypasses RLS for API routes that need unrestricted access.

## Notes

- The `pgcrypto` extension is enabled in migration `001` for `gen_random_uuid()`.
- The `service_role` key should never be exposed to the browser. It is only used server-side in API routes.

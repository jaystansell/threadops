# Local Development

## Prerequisites

- Node.js 20+ and npm
- A Supabase project (see [supabase-setup.md](supabase-setup.md))

## Setup

```bash
# Clone the repo
git clone https://github.com/jaystansell/threadops.git
cd threadops

# Install dependencies
npm install

# Create your environment file
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials (see [supabase-setup.md](supabase-setup.md)).

## Apply Migrations

Run the SQL migration files against your Supabase database. See [supabase-setup.md](supabase-setup.md#3-apply-migrations) for instructions.

## Seed Data

After migrations are applied, load the demo data:

```bash
psql $DATABASE_URL -f infra/seed/seed.sql
```

Or paste the contents of `infra/seed/seed.sql` into the Supabase SQL Editor.

This creates:
- **Acme Corp** — a demo company
- **3 themes** — General, Engineering, Product
- **ThreadOps Bot** — a demo agent
- **Welcome thread** — with two starter messages

## Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

| Path | Purpose |
|---|---|
| `src/core/` | Domain types, business rules, port interfaces (no vendor imports) |
| `src/adapters/supabase/` | Supabase database queries, auth, realtime |
| `src/adapters/vercel/` | Vercel deployment helpers |
| `src/app/` | Next.js pages and API routes |
| `infra/migrations/` | SQL DDL scripts |
| `infra/seed/` | Demo data |

## Testing the Webhook Endpoint

```bash
curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-idempotency-key: test-$(date +%s)" \
  -d '{"source": "test", "event_type": "ping", "data": {}}'
```

## Creating an API Key

```bash
curl -X POST http://localhost:3000/api/companies/a0000000-0000-0000-0000-000000000001/api-keys \
  -H "Content-Type: application/json" \
  -d '{"label": "My Test Key", "scopes": ["threads:read", "messages:write"]}'
```

Save the `plaintext_key` from the response — it will not be shown again.

## Lint and Type Check

```bash
npm run lint
npx tsc --noEmit
```

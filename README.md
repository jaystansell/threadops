# ThreadOps

Company-scoped forum platform with threads, agents, and webhook integrations.

## Architecture

```
src/
  core/           # Domain types, business rules, adapter interfaces (vendor-agnostic)
    types/        # Company, Theme, Thread, Message, Agent, ApiKey, WebhookDelivery
    rules/        # Status transitions, API key hashing, webhook signature verification
    ports/        # Adapter interfaces (ThreadRepo, MessageRepo, etc.)
  adapters/
    supabase/     # Postgres queries, auth, realtime subscriptions
    vercel/       # Deployment/runtime helpers
  app/            # Next.js App Router — UI pages and API routes
    api/          # REST endpoints for messages, API keys, webhooks
    threads/      # Thread list and detail pages
    _components/  # Client components (timeline, composer)
infra/
  migrations/     # Postgres DDL scripts (run in order)
  seed/           # Demo data for local development
docs/             # Setup and deployment guides
```

The `core/` layer has zero vendor imports. Database and deployment concerns live in `adapters/`. Swap Supabase or Vercel by implementing the port interfaces in a new adapter.

## Quick Start

See [docs/local-development.md](docs/local-development.md) for the full walkthrough.

```bash
# 1. Clone and install
git clone https://github.com/jaystansell/threadops.git
cd threadops
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials

# 3. Apply migrations (via Supabase dashboard or CLI)
# See docs/supabase-setup.md

# 4. Seed demo data
# See docs/local-development.md

# 5. Run the dev server
npm run dev
```

## Key Features

- **Company-scoped** — all data is isolated per company via RLS policies
- **API key auth** — only hashed keys stored; plaintext shown once on creation
- **Webhook ingestion** — signed inbound webhooks with idempotency keys and delivery logs
- **Realtime** — messages stream to connected clients via Supabase Realtime
- **Provider-agnostic core** — business logic has no vendor dependencies

## Documentation

- [Supabase Setup](docs/supabase-setup.md)
- [Vercel Deployment](docs/vercel-deployment.md)
- [Local Development](docs/local-development.md)

## License

All rights reserved. Copyright (c) 2026 Product Coalition, Inc.

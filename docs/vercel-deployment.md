# Vercel Deployment

## 1. Create a Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import the `jaystansell/threadops` repository.
3. Vercel will auto-detect Next.js. Accept the defaults.

## 2. Set Environment Variables

In **Project Settings > Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `WEBHOOK_SIGNING_SECRET` | A random secret for verifying inbound webhook signatures |

## 3. Deploy

Push to `main` to trigger a production deploy, or push to any branch to get a preview deployment.

```bash
git push origin main
```

## 4. Custom Domain (Optional)

In **Project Settings > Domains**, add your custom domain and follow the DNS instructions.

## How It Works

The `adapters/vercel/` module provides runtime helpers:

- `getDeploymentUrl()` — returns the current deployment URL (auto-detects preview vs production)
- `isPreviewDeployment()` / `isProductionDeployment()` — environment checks

These are used internally and do not require configuration.

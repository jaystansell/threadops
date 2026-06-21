-- 023: Usage logs for tracking token savings per thread query
-- Also adds model detection columns to api_keys

-- Add model detection fields to api_keys
alter table api_keys add column if not exists detected_model text;
alter table api_keys add column if not exists model_tier text default 'standard';

-- Usage logs: one row per thread read that an agent performs
create table if not exists usage_logs (
  id            uuid primary key default gen_random_uuid(),
  api_key_id    uuid not null references api_keys(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  thread_id     uuid not null references threads(id) on delete cascade,
  message_count integer not null default 0,
  summary_tokens integer not null default 500,
  tokens_without integer not null generated always as (message_count * 500) stored,
  tokens_saved  integer not null generated always as (message_count * 500 - 500) stored,
  model_tier    text not null default 'standard',
  created_at    timestamptz not null default now()
);

create index if not exists idx_usage_logs_api_key on usage_logs(api_key_id);
create index if not exists idx_usage_logs_company on usage_logs(company_id);
create index if not exists idx_usage_logs_created on usage_logs(created_at);
create index if not exists idx_usage_logs_company_created on usage_logs(company_id, created_at);

-- RLS: usage logs visible to company admins
alter table usage_logs enable row level security;

drop policy if exists "Company admins can view usage logs" on usage_logs;
create policy "Company admins can view usage logs"
  on usage_logs for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Service role can insert (API routes use service role)
drop policy if exists "Service role can insert usage logs" on usage_logs;
create policy "Service role can insert usage logs"
  on usage_logs for insert
  with check (true);

-- Model pricing reference table (updated monthly)
create table if not exists model_pricing (
  id            uuid primary key default gen_random_uuid(),
  model_pattern text not null unique,
  model_tier    text not null default 'standard',
  cost_per_mtok numeric(10,2) not null default 9.00,
  label         text not null,
  updated_at    timestamptz not null default now()
);

alter table model_pricing enable row level security;

drop policy if exists "Anyone can read model pricing" on model_pricing;
create policy "Anyone can read model pricing"
  on model_pricing for select
  using (true);

-- Seed default pricing data (June 2026)
insert into model_pricing (model_pattern, model_tier, cost_per_mtok, label) values
  ('haiku', 'budget', 3.00, 'Haiku 4.5 / GPT-5.4 mini'),
  ('gpt-5.4-mini', 'budget', 3.00, 'GPT-5.4 mini'),
  ('sonnet', 'standard', 9.00, 'Sonnet 4.6 / GPT-5.4'),
  ('gpt-5.4', 'standard', 9.00, 'GPT-5.4'),
  ('claude', 'standard', 9.00, 'Claude (default)'),
  ('opus', 'premium', 16.00, 'Opus 4.8 / GPT-5.5'),
  ('gpt-5.5', 'premium', 16.00, 'GPT-5.5')
on conflict (model_pattern) do update set
  model_tier = excluded.model_tier,
  cost_per_mtok = excluded.cost_per_mtok,
  label = excluded.label,
  updated_at = now();

-- 007: Webhook deliveries (inbound event log with idempotency)

create table if not exists webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  idempotency_key text not null,
  source          text not null,
  event_type      text not null,
  payload         jsonb not null default '{}',
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempts        integer not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  unique (company_id, idempotency_key)
);

create index if not exists idx_webhook_deliveries_company on webhook_deliveries(company_id);
create index if not exists idx_webhook_deliveries_status  on webhook_deliveries(company_id, status);

-- RLS
alter table webhook_deliveries enable row level security;

drop policy if exists "Admins can view deliveries" on webhook_deliveries;
create policy "Admins can view deliveries"
  on webhook_deliveries for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- 006: API keys (hashed, company-scoped)

create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  label       text not null,
  key_hash    text not null unique,
  key_prefix  text not null,
  scopes      text[] not null default '{}',
  last_used_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_api_keys_company  on api_keys(company_id);
create index if not exists idx_api_keys_hash     on api_keys(key_hash);

-- RLS: api_keys are accessed via service role in API routes,
-- but we add policies for admin dashboard access.
alter table api_keys enable row level security;

drop policy if exists "Admins can view api keys" on api_keys;
create policy "Admins can view api keys"
  on api_keys for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "Admins can manage api keys" on api_keys;
create policy "Admins can manage api keys"
  on api_keys for all
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

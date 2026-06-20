-- 001: Companies and company members
create extension if not exists "pgcrypto";

create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null,
  role        text not null default 'member'
              check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_company_members_company on company_members(company_id);
create index if not exists idx_company_members_user    on company_members(user_id);

-- updated_at trigger
drop trigger if exists companies_set_updated_at on companies;
create trigger companies_set_updated_at
  before update on companies
  for each row execute function public.set_updated_at();

-- RLS
alter table companies enable row level security;
alter table company_members enable row level security;

drop policy if exists "Members can view their company" on companies;
create policy "Members can view their company"
  on companies for select
  using (
    id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Members can view fellow members" on company_members;
create policy "Members can view fellow members"
  on company_members for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Owners can insert members" on company_members;
create policy "Owners can insert members"
  on company_members for insert
  with check (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

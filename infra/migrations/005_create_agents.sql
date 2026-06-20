-- 005: Agents (automated actors that can post messages on behalf of integrations)

create table if not exists agents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_agents_company on agents(company_id);

-- updated_at trigger
drop trigger if exists agents_set_updated_at on agents;
create trigger agents_set_updated_at
  before update on agents
  for each row execute function public.set_updated_at();

-- RLS
alter table agents enable row level security;

drop policy if exists "Members can view agents" on agents;
create policy "Members can view agents"
  on agents for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Admins can manage agents" on agents;
create policy "Admins can manage agents"
  on agents for all
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

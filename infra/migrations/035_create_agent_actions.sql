-- 035: Agent actions — agents declare structured actions with JSON Schema parameters

create table if not exists agent_actions (
  id               uuid primary key default gen_random_uuid(),
  api_key_id       uuid not null references api_keys(id) on delete cascade,
  company_id       uuid not null references companies(id) on delete cascade,
  name             text not null,
  description      text not null default '',
  parameter_schema jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (api_key_id, name)
);

create index if not exists idx_agent_actions_api_key on agent_actions(api_key_id);
create index if not exists idx_agent_actions_company on agent_actions(company_id);

alter table agent_actions enable row level security;

drop policy if exists "Users can view actions for their company keys" on agent_actions;
create policy "Users can view actions for their company keys"
  on agent_actions for select
  using (
    api_key_id in (
      select ak.id from api_keys ak
      join company_members cm on cm.company_id = ak.company_id
      where cm.user_id = auth.uid()
    )
  );

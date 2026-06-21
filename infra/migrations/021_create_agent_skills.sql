-- 021: Agent skills — agents report capabilities, scoped to their API key

create table if not exists agent_skills (
  id          uuid primary key default gen_random_uuid(),
  api_key_id  uuid not null references api_keys(id) on delete cascade,
  skill_name  text not null,
  created_at  timestamptz not null default now(),
  unique (api_key_id, skill_name)
);

create index if not exists idx_agent_skills_api_key on agent_skills(api_key_id);

alter table agent_skills enable row level security;

drop policy if exists "Users can view skills for their company keys" on agent_skills;
create policy "Users can view skills for their company keys"
  on agent_skills for select
  using (
    api_key_id in (
      select ak.id from api_keys ak
      join company_members cm on cm.company_id = ak.company_id
      where cm.user_id = auth.uid()
    )
  );

-- 002: Themes (categories for threads within a company)

create table if not exists themes (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists idx_themes_company on themes(company_id);

-- updated_at trigger
drop trigger if exists themes_set_updated_at on themes;
create trigger themes_set_updated_at
  before update on themes
  for each row execute function public.set_updated_at();

-- RLS
alter table themes enable row level security;

drop policy if exists "Members can view themes" on themes;
create policy "Members can view themes"
  on themes for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Admins can manage themes" on themes;
create policy "Admins can manage themes"
  on themes for all
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- 003: Threads

create table if not exists threads (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  theme_id    uuid references themes(id) on delete set null,
  title       text not null,
  status      text not null default 'open'
              check (status in ('open', 'closed', 'archived')),
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_threads_company on threads(company_id);
create index if not exists idx_threads_theme   on threads(theme_id);
create index if not exists idx_threads_status  on threads(company_id, status);

-- updated_at trigger
drop trigger if exists threads_set_updated_at on threads;
create trigger threads_set_updated_at
  before update on threads
  for each row execute function public.set_updated_at();

-- RLS
alter table threads enable row level security;

drop policy if exists "Members can view threads" on threads;
create policy "Members can view threads"
  on threads for select
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Members can create threads" on threads;
create policy "Members can create threads"
  on threads for insert
  with check (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid()
    )
  );

drop policy if exists "Admins can update threads" on threads;
create policy "Admins can update threads"
  on threads for update
  using (
    company_id in (
      select company_id from company_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

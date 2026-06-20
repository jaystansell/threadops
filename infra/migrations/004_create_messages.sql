-- 004: Messages

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references threads(id) on delete cascade,
  author_id   uuid not null,
  author_kind text not null default 'user'
              check (author_kind in ('user', 'agent')),
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_messages_thread on messages(thread_id);

-- updated_at trigger
drop trigger if exists messages_set_updated_at on messages;
create trigger messages_set_updated_at
  before update on messages
  for each row execute function public.set_updated_at();

-- RLS
alter table messages enable row level security;

drop policy if exists "Members can view messages" on messages;
create policy "Members can view messages"
  on messages for select
  using (
    thread_id in (
      select t.id from threads t
      join company_members cm on cm.company_id = t.company_id
      where cm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can post messages" on messages;
create policy "Members can post messages"
  on messages for insert
  with check (
    thread_id in (
      select t.id from threads t
      join company_members cm on cm.company_id = t.company_id
      where cm.user_id = auth.uid()
    )
  );

-- Enable realtime for messages
alter publication supabase_realtime add table messages;

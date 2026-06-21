-- Thread events: track status changes and other lifecycle events
create table if not exists thread_events (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references threads(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  event_type  text not null,          -- 'status_changed', 'auto_reopened'
  actor_kind  text not null,          -- 'user', 'agent', 'system'
  actor_label text,                   -- display name (agent label, user email, or null for system)
  old_value   text,                   -- previous status
  new_value   text,                   -- new status
  created_at  timestamptz not null default now()
);

create index if not exists idx_thread_events_thread on thread_events(thread_id);
create index if not exists idx_thread_events_created on thread_events(created_at);

alter table thread_events enable row level security;

drop policy if exists "Users can view events for their company threads" on thread_events;
create policy "Users can view events for their company threads"
  on thread_events for select
  using (
    company_id in (
      select cm.company_id from company_members cm
      where cm.user_id = auth.uid()
    )
  );

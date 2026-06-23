-- Agent processing status: tracks agent acknowledgement and processing lifecycle
create table if not exists agent_processing_status (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references threads(id) on delete cascade,
  api_key_id  uuid not null references api_keys(id) on delete cascade,
  message_id  uuid references messages(id) on delete set null,
  status      text not null,  -- 'acknowledged', 'processing', 'completed', 'escalated'
  created_at  timestamptz not null default now()
);

create index if not exists idx_agent_processing_status_thread on agent_processing_status(thread_id);
create index if not exists idx_agent_processing_status_created on agent_processing_status(created_at desc);

alter table agent_processing_status enable row level security;

-- Users can view processing status for threads in their company
drop policy if exists "Users can view processing status for their company threads" on agent_processing_status;
create policy "Users can view processing status for their company threads"
  on agent_processing_status for select
  using (
    thread_id in (
      select t.id from threads t
      inner join company_members cm on cm.company_id = t.company_id
      where cm.user_id = auth.uid()
    )
  );

-- Service role can insert (API routes use service role client)
drop policy if exists "Service role can insert processing status" on agent_processing_status;
create policy "Service role can insert processing status"
  on agent_processing_status for insert
  with check (true);

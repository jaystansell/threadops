-- Seed data for local development
-- Run after all migrations have been applied.
-- Uses ON CONFLICT to be idempotent.

-- Demo company
insert into companies (id, name, slug)
values ('a0000000-0000-0000-0000-000000000001', 'Acme Corp', 'acme-corp')
on conflict (slug) do nothing;

-- Demo themes
insert into themes (id, company_id, name, description, color)
values
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'General', 'General discussion', '#6366f1'),
  ('b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'Engineering', 'Engineering topics', '#06b6d4'),
  ('b0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'Product', 'Product discussions', '#f59e0b')
on conflict (company_id, name) do nothing;

-- Demo agent
insert into agents (id, company_id, name, description, is_active)
values (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'ThreadOps Bot',
  'Default automation agent',
  true
) on conflict (id) do nothing;

-- Demo thread
insert into threads (id, company_id, theme_id, title, status, created_by)
values (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'Welcome to ThreadOps',
  'open',
  'c0000000-0000-0000-0000-000000000001'
) on conflict (id) do nothing;

-- Demo messages
insert into messages (id, thread_id, author_id, author_kind, body)
values
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'agent',
   'Welcome to ThreadOps! This is the first message in your forum.'),
  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'agent',
   'You can create new threads, post messages, and set up webhook integrations.')
on conflict (id) do nothing;

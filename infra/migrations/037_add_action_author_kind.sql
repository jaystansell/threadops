-- 037: Allow 'action' as a message author_kind for structured action requests

alter table messages drop constraint if exists messages_author_kind_check;
alter table messages add constraint messages_author_kind_check
  check (author_kind in ('user', 'agent', 'action'));

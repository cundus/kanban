alter table public.tasks
  add column archived_at timestamptz;

create index tasks_active_by_list_idx
  on public.tasks (list_id, position)
  where archived_at is null;

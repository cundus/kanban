create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on public.task_assignees(user_id);

alter table public.task_assignees enable row level security;

create policy "members can view task assignees" on public.task_assignees
  for select using (
    exists (
      select 1 from public.tasks t
      join public.project_members pm on pm.project_id = t.project_id
      where t.id = task_assignees.task_id and pm.user_id = auth.uid()
    )
  );

create policy "members can manage task assignees" on public.task_assignees
  for all using (
    exists (
      select 1 from public.tasks t
      join public.project_members pm on pm.project_id = t.project_id
      where t.id = task_assignees.task_id and pm.user_id = auth.uid()
    )
  );

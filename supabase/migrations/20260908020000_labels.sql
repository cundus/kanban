create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index labels_project_idx on public.labels(project_id);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index task_labels_label_idx on public.task_labels(label_id);

alter table public.labels enable row level security;

create policy "members can view labels" on public.labels
  for select using (public.is_project_member(project_id));

create policy "members can manage labels" on public.labels
  for all using (public.is_project_member(project_id));

alter table public.task_labels enable row level security;

create policy "members can view task labels" on public.task_labels
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_labels.task_id
        and public.is_project_member(t.project_id)
    )
  );

create policy "members can manage task labels" on public.task_labels
  for all using (
    exists (
      select 1 from public.tasks t
      where t.id = task_labels.task_id
        and public.is_project_member(t.project_id)
    )
  );

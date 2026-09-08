drop policy "members can view task assignees" on public.task_assignees;
drop policy "members can manage task assignees" on public.task_assignees;

create policy "members can view task assignees" on public.task_assignees
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and public.is_project_member(t.project_id)
    )
  );

create policy "members can manage task assignees" on public.task_assignees
  for all using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and public.is_project_member(t.project_id)
    )
  );

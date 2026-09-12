-- 20260912000000_task_serial_number.sql
-- Serial Number untuk task card: nomor urut per-project (mulai dari 1) supaya
-- task bisa direferensikan dengan angka pendek ("task #42") alih-alih UUID —
-- terutama saat assign task lewat MCP tools.

alter table public.tasks add column serial_number integer;

-- Backfill task lama: nomori per project, urut berdasarkan updated_at lalu id
-- (tasks tidak punya created_at, jadi ini hanya perlu deterministik, bukan
-- akurat secara historis).
with numbered as (
  select id, row_number() over (partition by project_id order by updated_at, id) as rn
  from public.tasks
)
update public.tasks t
set serial_number = numbered.rn
from numbered
where t.id = numbered.id;

alter table public.tasks alter column serial_number set not null;

create unique index tasks_project_serial_number_idx
  on public.tasks (project_id, serial_number);

-- Trigger: assign nomor berikutnya per project saat insert, kecuali sudah
-- diisi eksplisit.
create or replace function public.set_task_serial_number()
returns trigger
language plpgsql
as $$
begin
  if new.serial_number is null then
    select coalesce(max(serial_number), 0) + 1 into new.serial_number
    from public.tasks
    where project_id = new.project_id;
  end if;
  return new;
end;
$$;

create trigger set_task_serial_number_trigger
  before insert on public.tasks
  for each row execute procedure public.set_task_serial_number();

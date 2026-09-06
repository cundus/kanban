-- lists.position dan tasks.position: integer -> double precision (fractional index)
alter table lists alter column position type double precision using position::double precision;
alter table lists alter column position set default 1024;

alter table tasks alter column position type double precision using position::double precision;
alter table tasks alter column position set default 1024;

-- re-space baris lama supaya midpoint insert punya ruang (urutan visual dipertahankan)
with ranked as (
  select id, row_number() over (partition by project_id order by position, id) as rn
  from lists
)
update lists set position = ranked.rn * 1024
from ranked where lists.id = ranked.id;

with ranked as (
  select id, row_number() over (partition by list_id order by position, id) as rn
  from tasks
)
update tasks set position = ranked.rn * 1024
from ranked where tasks.id = ranked.id;

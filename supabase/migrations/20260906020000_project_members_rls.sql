-- 20260906020000_project_members_rls.sql
-- Fase 3: Invite Member + RLS multi-user.
-- Menambah tabel project_members, fungsi helper SECURITY DEFINER (mencegah
-- rekursi RLS projects <-> project_members), trigger owner-membership, backfill
-- project lama, lalu menulis ulang policy projects/lists/tasks/profiles dari
-- basis owner_id ke basis keanggotaan.
--
-- JANGAN sunting 20260906000000_init_schema.sql atau
-- 20260906010000_fractional_positions.sql — keduanya sudah applied ke DB live.

-- =========================================================================
-- 1. Tabel project_members  (PRD §7.1)
-- =========================================================================
create table project_members (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,   -- null selama pending
  invited_email text not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz
);

-- satu email hanya sekali per project; satu user hanya sekali per project
create unique index project_members_project_email_idx
  on project_members (project_id, lower(invited_email));
create unique index project_members_project_user_idx
  on project_members (project_id, user_id)
  where user_id is not null;

-- percepat policy & klaim
create index project_members_user_idx
  on project_members (user_id)
  where user_id is not null;
create index project_members_email_idx
  on project_members (lower(invited_email));

alter table project_members enable row level security;

-- =========================================================================
-- 2. Fungsi helper — SECURITY DEFINER.
--    Dibuat via migrasi => dimiliki `postgres` (BYPASSRLS). Fungsi
--    SECURITY DEFINER berjalan sebagai pemilik, jadi query internalnya TIDAK
--    kena RLS lagi. Tanpa ini, policy `projects` yang membaca `project_members`
--    dan policy `project_members` yang membaca `projects` akan saling memicu:
--    "infinite recursion detected in policy for relation ...".
-- =========================================================================
create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from project_members
    where project_id = p_project
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;

create or replace function public.is_project_owner(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects
    where id = p_project
      and owner_id = auth.uid()
  );
$$;

create or replace function public.shares_project_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from project_members me
    join project_members other on other.project_id = me.project_id
    where me.user_id = auth.uid() and me.status = 'accepted'
      and other.user_id = p_user and other.status = 'accepted'
  );
$$;

-- Klaim undangan: dipanggil client (RPC) setelah login Google. Mencocokkan
-- invited_email dengan email akun, mengisi user_id, set accepted.
-- SECURITY DEFINER supaya tidak butuh policy UPDATE di project_members.
create or replace function public.claim_pending_invites()
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with claimed as (
    update project_members
    set user_id     = auth.uid(),
        status      = 'accepted',
        accepted_at = now()
    where status = 'pending'
      and user_id is null
      and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(coalesce(auth.jwt() ->> 'email', '')) <> ''
    returning 1
  )
  select count(*)::int from claimed;
$$;

-- hak eksekusi: hanya user login
revoke all on function public.is_project_member(uuid)   from public;
revoke all on function public.is_project_owner(uuid)    from public;
revoke all on function public.shares_project_with(uuid) from public;
revoke all on function public.claim_pending_invites()   from public;
grant execute on function public.is_project_member(uuid)   to authenticated;
grant execute on function public.is_project_owner(uuid)    to authenticated;
grant execute on function public.shares_project_with(uuid) to authenticated;
grant execute on function public.claim_pending_invites()   to authenticated;

-- =========================================================================
-- 3. Trigger owner-membership — setiap project baru otomatis punya baris
--    owner (accepted). Pola sama dengan handle_new_user() baseline; dilakukan
--    di DB supaya tidak bisa terlewat & tak perlu policy INSERT longgar.
-- =========================================================================
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into project_members (project_id, user_id, invited_email, role, status, accepted_at)
  values (
    new.id,
    new.owner_id,
    coalesce((select email from profiles where id = new.owner_id), ''),
    'owner',
    'accepted',
    now()
  );
  return new;
end;
$$;

create trigger on_project_created
  after insert on projects
  for each row execute procedure public.handle_new_project();

-- =========================================================================
-- 4. Backfill — project yang dibuat sebelum Fase 3 belum punya baris owner.
-- =========================================================================
insert into project_members (project_id, user_id, invited_email, role, status, accepted_at)
select p.id, p.owner_id, coalesce(pr.email, ''), 'owner', 'accepted', now()
from projects p
left join profiles pr on pr.id = p.owner_id
on conflict do nothing;

-- =========================================================================
-- 5. project_members — policies
-- =========================================================================

-- SELECT: anggota accepted melihat seluruh roster; owner melihat roster;
-- yang diundang melihat baris undangannya sendiri (untuk UI "kamu diundang").
create policy "project_members select"
  on project_members for select
  using (
    public.is_project_member(project_id)
    or public.is_project_owner(project_id)
    or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- INSERT: hanya owner project; hanya undangan member/pending.
-- (Baris owner datang dari trigger handle_new_project, bukan lewat policy ini.)
create policy "project_members insert by owner"
  on project_members for insert
  with check (
    public.is_project_owner(project_id)
    and role = 'member'
    and status = 'pending'
  );

-- DELETE: owner menghapus member (bukan baris owner);
--         atau member menghapus baris dirinya sendiri (leave project).
create policy "project_members delete by owner"
  on project_members for delete
  using (public.is_project_owner(project_id) and role <> 'owner');

create policy "project_members leave"
  on project_members for delete
  using (user_id = auth.uid() and role <> 'owner');

-- Tidak ada policy UPDATE: klaim undangan lewat claim_pending_invites().

-- =========================================================================
-- 6. projects — dari owner-only ke basis keanggotaan
-- =========================================================================
drop policy "Owners can select own projects" on projects;
drop policy "Owners can update own projects" on projects;
drop policy "Owners can delete own projects" on projects;
-- "Owners can insert own projects" (owner_id = auth.uid()) DIPERTAHANKAN.

create policy "Members can select projects"
  on projects for select
  using (owner_id = auth.uid() or public.is_project_member(id));

create policy "Owners can update projects"
  on projects for update
  using (owner_id = auth.uid());

create policy "Owners can delete projects"
  on projects for delete
  using (owner_id = auth.uid());

-- =========================================================================
-- 7. lists — owner atau accepted member boleh CRUD penuh.
--    (Owner tercakup is_project_member lewat trigger + backfill baris owner.)
-- =========================================================================
drop policy "Owners can select own lists" on lists;
drop policy "Owners can insert own lists" on lists;
drop policy "Owners can update own lists" on lists;
drop policy "Owners can delete own lists" on lists;

create policy "Members can select lists"
  on lists for select using (public.is_project_member(project_id));
create policy "Members can insert lists"
  on lists for insert with check (public.is_project_member(project_id));
create policy "Members can update lists"
  on lists for update using (public.is_project_member(project_id));
create policy "Members can delete lists"
  on lists for delete using (public.is_project_member(project_id));

-- =========================================================================
-- 8. tasks — sama seperti lists.
-- =========================================================================
drop policy "Owners can select own tasks" on tasks;
drop policy "Owners can insert own tasks" on tasks;
drop policy "Owners can update own tasks" on tasks;
drop policy "Owners can delete own tasks" on tasks;

create policy "Members can select tasks"
  on tasks for select using (public.is_project_member(project_id));
create policy "Members can insert tasks"
  on tasks for insert with check (public.is_project_member(project_id));
create policy "Members can update tasks"
  on tasks for update using (public.is_project_member(project_id));
create policy "Members can delete tasks"
  on tasks for delete using (public.is_project_member(project_id));

-- =========================================================================
-- 9. profiles — sesama anggota project boleh saling melihat profil
--    (nama/email/avatar) supaya daftar member bisa dirender.
--    Policy "Users can view own profile" baseline tetap ada; policy permissive
--    di-OR oleh Postgres.
-- =========================================================================
create policy "Co-members can view profiles"
  on profiles for select
  using (id = auth.uid() or public.shares_project_with(id));

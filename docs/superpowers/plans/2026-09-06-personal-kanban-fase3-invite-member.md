# Personal Kanban — Fase 3 (Invite Member + RLS Multi-User) Implementation Plan

> **Untuk agen pelaksana:** REQUIRED SUB-SKILL: gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi plan ini task-by-task. Semua langkah pakai checkbox (`- [ ]`) untuk tracking. Isi dokumen Bahasa Indonesia; identifier & kode tetap Bahasa Inggris.

**Goal:** Ubah app dari single-owner menjadi multi-user berbasis keanggotaan. Tambah tabel `project_members`, fungsi helper `SECURITY DEFINER` (anti-rekursi RLS), trigger owner-membership, dan tulis ulang policy `projects`/`lists`/`tasks`/`profiles` ke basis keanggotaan. Frontend: fitur `members/` (dialog kelola member), klaim undangan otomatis saat login (`invited_email` ↔ email Google), role-gating tombol owner-only, sanitasi `marked` dengan DOMPurify. Tetap Google OAuth only, tanpa server email (bagikan link manual), Supabase free tier, RLS di DB, bundle tetap kecil. **Tidak menyentuh** drag&drop / markdown editor / fractional position.

**Architecture:** SPA React 18 + Vite tetap bicara langsung ke Supabase via `@supabase/supabase-js`; otorisasi via RLS. Rekursi `projects ↔ project_members` dicegah dengan fungsi `SECURITY DEFINER` milik `postgres` (BYPASSRLS). TanStack Query mengelola cache. Undangan diklaim lewat RPC `claim_pending_invites()` pada event auth `SIGNED_IN`.

**Tech Stack baru:** `dompurify` (+ `@types/dompurify` bila perlu). Tidak ada library UI baru.

**Spec:** `docs/superpowers/specs/2026-09-06-personal-kanban-fase3-design.md`

**Supabase project ref:** `nbcgglhxqtgewtoeqbnf`

**Migrasi baru:** `supabase/migrations/20260906020000_project_members_rls.sql` (draft lengkap ada di Task 1)

---

## Task 0: Prasyarat (verifikasi baseline, non-code)

Tidak menyentuh file. Wajib sebelum Task 1.

- [ ] **Step 1: Baca spec Fase 3** (`docs/superpowers/specs/2026-09-06-personal-kanban-fase3-design.md`) sampai paham §4 (data model), §5 (desain RLS + fungsi anti-rekursi), §6 (alur invite), §7 (UI).

- [ ] **Step 2: Baca ulang** `docs/PRD-Personal-Kanban-App.md` §4.2 & §7.1, dan `docs/MEMORY.md` (butir "No `project_members` table" + daftar Deferred).

- [ ] **Step 3: Pastikan baseline hijau**

```bash
pnpm install
pnpm exec tsc -b
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: `tsc` exit 0; self-check semua `PASS`.

- [ ] **Step 4: Buat branch kerja** (sudah dibuat saat planning: `fase3-invite-member`; kalau mulai dari nol jalankan)

```bash
git checkout -b fase3-invite-member
```

- [ ] **Step 5: Cek Supabase CLI** — `docs/MEMORY.md` mencatat CLI belum terpasang; regen types dilakukan manual (Task 2). Konfirmasi `DATABASE_URL` tersedia untuk `scripts/migrate.mjs` (dipakai Task 1 Step 3).

---

## Task 1: Migrasi `project_members` + fungsi + trigger + RLS rewrite

**Files:**
- Create: `supabase/migrations/20260906020000_project_members_rls.sql`

- [ ] **Step 1: Tulis file migrasi** dengan isi persis berikut.

```sql
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
```

**Penjelasan keputusan (rangkuman spec §5):**
- **Fungsi `SECURITY DEFINER`** — satu-satunya cara aman memutus rekursi `projects ↔ project_members`. Dimiliki `postgres` → query internal tidak kena RLS. `set search_path = public` mencegah hijack via search_path.
- **Trigger owner-membership** (bukan insert client) — tidak bisa terlewat, konsisten dengan baseline `handle_new_user()`, dan menghindari policy INSERT longgar.
- **Backfill** — tanpa ini owner project lama gagal `is_project_member` dan kehilangan akses boardnya sendiri.
- **`projects` INSERT dipertahankan** apa adanya — owner_id tetap `auth.uid()`; trigger AFTER menambah baris owner di transaksi yang sama.
- **`projects` UPDATE/DELETE owner-only** — PRD §4.2: hanya owner boleh hapus project.
- **`lists`/`tasks` full CRUD untuk member** — board Kanban kolaboratif; pelonggaran sadar dari PRD "member = CRUD task" (dicatat di MEMORY). Owner-only tetap: hapus/rename project + invite/remove member.
- **Tidak ada policy UPDATE `project_members`** — klaim via `claim_pending_invites()` (SECURITY DEFINER). Mengurangi permukaan serang.
- **Baris owner tak bisa dihapus manual** — kedua policy DELETE mensyaratkan `role <> 'owner'`; baris owner hanya hilang lewat `on delete cascade` saat project dihapus.

- [ ] **Step 2: Review SQL** — pastikan tiap `create policy` baru didahului `drop policy` untuk policy lama yang digantikan; tidak ada policy yatim; `project_members` `enable row level security` sebelum data apa pun bisa masuk.

- [ ] **Step 3: Terapkan migrasi ke project live**

```bash
pnpm migrate:status          # 20260906020000 harus tampil "pending"
pnpm migrate:up              # terapkan
```

Alternatif bila runner bermasalah: Supabase Dashboard → SQL Editor → paste isi file → Run. Expected: `Success`.

- [ ] **Step 4: Verifikasi di DB**

```sql
-- tabel + RLS aktif
select relrowsecurity from pg_class where relname = 'project_members';   -- t
-- fungsi ada & security definer
select proname, prosecdef from pg_proc
where proname in ('is_project_member','is_project_owner','shares_project_with','claim_pending_invites','handle_new_project');
-- policy projects tidak lagi owner-only select
select policyname, cmd from pg_policies where tablename = 'project_members' order by cmd;
-- backfill: tiap project punya minimal 1 baris owner
select count(*) from projects p
where not exists (select 1 from project_members m where m.project_id = p.id and m.role = 'owner');  -- 0
```

- [ ] **Step 5: Smoke test rekursi** — di SQL Editor sebagai `authenticated` (impersonate via `set request.jwt.claims`), `select * from projects;` tidak boleh melempar `infinite recursion detected in policy`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260906020000_project_members_rls.sql
git commit -m "feat(db): project_members table + membership-based RLS + invite claim fn"
```

---

## Task 2: Regenerasi types

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1:** Jika Supabase CLI tersedia:

```bash
supabase gen types typescript --project-id nbcgglhxqtgewtoeqbnf > src/types/database.types.ts
```

Lalu kembalikan komentar `ponytail:` di baris atas.

- [ ] **Step 2:** Jika CLI tidak tersedia (default — lihat MEMORY), edit manual:

- Tambah ke `Tables`:

```ts
project_members: {
  Row: {
    id: string
    project_id: string
    user_id: string | null
    invited_email: string
    role: "owner" | "member"
    status: "pending" | "accepted"
    created_at: string
    accepted_at: string | null
  }
  Insert: {
    id?: string
    project_id: string
    user_id?: string | null
    invited_email: string
    role?: "owner" | "member"
    status?: "pending" | "accepted"
    created_at?: string
    accepted_at?: string | null
  }
  Update: {
    id?: string
    project_id?: string
    user_id?: string | null
    invited_email?: string
    role?: "owner" | "member"
    status?: "pending" | "accepted"
    created_at?: string
    accepted_at?: string | null
  }
  Relationships: []
}
```

- Ganti `Functions: Record<string, never>` menjadi:

```ts
Functions: {
  is_project_member: { Args: { p_project: string }; Returns: boolean }
  is_project_owner: { Args: { p_project: string }; Returns: boolean }
  shares_project_with: { Args: { p_user: string }; Returns: boolean }
  claim_pending_invites: { Args: Record<string, never>; Returns: number }
}
```

- Perbarui komentar `ponytail:` di baris atas agar menyebut `project_members` + fungsi RLS Fase 3.

- [ ] **Step 3: Verifikasi**

```bash
pnpm exec tsc -b
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): add project_members + RLS helper function signatures"
```

---

## Task 3: Klaim undangan saat login + hook role

**Files:**
- Modify: `src/features/auth/useAuth.ts`
- Create: `src/features/members/useMembership.ts`

- [ ] **Step 1: `useAuth` memanggil `claim_pending_invites` pada `SIGNED_IN`**

Di dalam `onAuthStateChange`, saat `_event === "SIGNED_IN"` (atau `session` berubah dari null → ada):

```ts
const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
  setSession(newSession)
  if (event === "SIGNED_IN" && newSession) {
    supabase.rpc("claim_pending_invites").then(({ data, error }) => {
      if (!error && data && data > 0) {
        queryClient.invalidateQueries({ queryKey: ["projects"] })
      }
    })
  }
})
```

`useAuth` perlu akses `queryClient` (`useQueryClient()` dari `@tanstack/react-query`). Jalankan klaim juga sekali di `getSession().then(...)` bila `data.session` ada (menangani reload setelah redirect OAuth). Idempoten — aman dipanggil berulang.

- [ ] **Step 2: `useMembership(projectId)` — role user saat ini**

```ts
// src/features/members/useMembership.ts
export function useMembership(projectId: string) {
  return useQuery({
    queryKey: ["membership", projectId],
    queryFn: async (): Promise<{ role: "owner" | "member" | null }> => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return { role: null }
      const { data, error } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", uid)
        .eq("status", "accepted")
        .maybeSingle()
      if (error) throw error
      return { role: (data?.role as "owner" | "member" | undefined) ?? null }
    },
  })
}
```

Helper turunan: `const isOwner = role === "owner"`.

- [ ] **Step 3: Verifikasi**

```bash
pnpm exec tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/useAuth.ts src/features/members/useMembership.ts
git commit -m "feat(auth): claim pending invites on sign-in; add useMembership role hook"
```

---

## Task 4: Fitur members — hooks + dialog

**Files:**
- Create: `src/features/members/useMembers.ts`
- Create: `src/features/members/MembersDialog.tsx`

- [ ] **Step 1: `useMembers.ts`** — query + mutations

- `useMembers(projectId)`: `select` `project_members` `eq project_id`, `order created_at`. Join profil manual: kedua query (`project_members` + `profiles` untuk `user_id` yang ada) lalu gabung di client — atau embed `profiles` via foreign-key select `("*, profiles:user_id(full_name, avatar_url, email)")` bila RLS profiles mengizinkan (sudah, lewat `shares_project_with`). Pilih embed; fallback ke dua query bila embed error.
- `useInviteMember(projectId)`: `insert({ project_id, invited_email: email.trim().toLowerCase(), role: "member", status: "pending" })`. `onError` → `toast.error` (mis. unique violation = "Email sudah diundang"). `onSuccess` → invalidate `["members", projectId]` + `toast.success`.
- `useRemoveMember(projectId)`: `delete().eq("id", memberRowId)`. invalidate `["members", projectId]`.
- `useLeaveProject(projectId)`: `delete().eq("project_id", projectId).eq("user_id", <uid>)`. `onSuccess` → invalidate `["projects"]` + navigate `/`.

Semua mutation: pola `invalidate-on-success` (konsisten dgn CRUD non-board Fase 2), `toast` di `onError`.

- [ ] **Step 2: `MembersDialog.tsx`** — lihat spec §7.1

Props: `{ projectId: string; projectName: string; open: boolean; onOpenChange: (o: boolean) => void }`.

- `useMembership(projectId)` → `isOwner`.
- Baris tambah (hanya bila `isOwner`): `Input` email + `Button` "Invite", disable saat kosong / bukan format email sederhana (`/^\S+@\S+\.\S+$/`).
- Daftar: map `useMembers` → baris { avatar (fallback inisial dari nama/email), nama atau `invited_email`, email, badge }.
  - Badge role: `Owner` (`<span>` styled solid) / `Member` (outline). Baris `status === "pending"`: badge abu `Pending`.
  - Owner-only, hanya baris `role === "member"`: tombol ✕ `Remove` → `window.confirm` → `useRemoveMember`.
  - Baris pending (owner-only): tombol `Copy link` (`navigator.clipboard.writeText(\`${location.origin}/projects/${projectId}\`)` + `toast.success`) dan `Cancel invite` (= `useRemoveMember`).
- Footer: bila `!isOwner`, tombol `Leave project` → `window.confirm` → `useLeaveProject`.
- Non-owner: daftar read-only (tanpa Invite / Remove / Cancel).

Gunakan komponen `@/components/ui/dialog`, `button`, `input` yang sudah ada. Tanpa dependency baru.

- [ ] **Step 3: Verifikasi**

```bash
pnpm exec tsc -b
```

- [ ] **Step 4: Commit**

```bash
git add src/features/members/useMembers.ts src/features/members/MembersDialog.tsx
git commit -m "feat(members): invite/remove/leave hooks + MembersDialog"
```

---

## Task 5: Integrasi BoardPage

**Files:**
- Modify: `src/features/board/BoardPage.tsx`

- [ ] **Step 1: Tombol "Members" di header** — di `div` header sebelah "← Back to projects":

```tsx
const [membersOpen, setMembersOpen] = useState(false)
// ...
<Button variant="outline" onClick={() => setMembersOpen(true)}>Members</Button>
// ...
{membersOpen && (
  <MembersDialog
    projectId={projectId}
    projectName={/* dari useProject / lists[0]?.project? — ambil nama project */ ""}
    open={membersOpen}
    onOpenChange={setMembersOpen}
  />
)}
```

Nama project: `BoardPage` belum meng-query `projects`. Tambah `useProject(projectId)` ringan di `useProjects.ts` (`select("*").eq("id", projectId).single()`), atau teruskan `projectName` opsional dan tampilkan "Members" saja bila belum ada. Pilih `useProject` — sekalian berguna untuk judul board.

- [ ] **Step 2: (opsional) tampilkan nama project sebagai judul board** memakai `useProject`.

- [ ] **Step 3: Role-gating** — tidak ada kontrol project-level di BoardPage; hapus list tetap terbuka untuk semua member (spec §5.3). Tidak ada perubahan lain yang diperlukan di sini.

- [ ] **Step 4: Verifikasi**

```bash
pnpm exec tsc -b
pnpm dev   # header board punya tombol Members; dialog terbuka
```

- [ ] **Step 5: Commit**

```bash
git add src/features/board/BoardPage.tsx src/features/projects/useProjects.ts
git commit -m "feat(board): Members button + dialog wired into BoardPage header"
```

---

## Task 6: Integrasi daftar project (badge role + gating)

**Files:**
- Modify: `src/features/projects/useProjects.ts`, `src/features/projects/ProjectCard.tsx`, `src/features/projects/ProjectListPage.tsx`

- [ ] **Step 1: `useProjects` sertakan info role**

Setelah ambil `projects` (RLS kini mengembalikan owned + shared), ambil `user.id` dan tandai `isOwner = project.owner_id === uid` per baris — tanpa query kedua. Kembalikan `(Project & { isOwner: boolean })[]`. Urutkan owned dulu lalu shared, tie-break `created_at desc`.

- [ ] **Step 2: `ProjectCard`** terima `isOwner`; tampilkan badge `Owner`/`Member`; sembunyikan tombol **Edit** & **Delete** bila `!isOwner` (tombol **Open** tetap).

- [ ] **Step 3: `ProjectListPage`** teruskan `project.isOwner` ke `ProjectCard`. Dialog create tetap milik semua user (create project = jadi owner).

- [ ] **Step 4: Verifikasi**

```bash
pnpm exec tsc -b
pnpm dev   # akun member: project shared tampil dgn badge Member, tanpa Edit/Delete
```

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/useProjects.ts src/features/projects/ProjectCard.tsx src/features/projects/ProjectListPage.tsx
git commit -m "feat(projects): owner/member badge + hide owner-only actions on shared projects"
```

---

## Task 7: Sanitasi markdown (DOMPurify)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `src/features/board/TaskDialog.tsx`, `src/features/board/MarkdownEditor.tsx`

- [ ] **Step 1: Install**

```bash
pnpm add dompurify
pnpm add -D @types/dompurify   # bila types tidak ikut bawaan
```

- [ ] **Step 2: Bungkus render HTML**

Di `TaskDialog.tsx` (mode view) dan `MarkdownEditor.tsx` (panel preview), ganti:

```tsx
dangerouslySetInnerHTML={{ __html: marked.parse(md) as string }}
```

menjadi:

```tsx
import DOMPurify from "dompurify"
// ...
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(md) as string) }}
```

Pertimbangkan helper kecil `renderMarkdown(md: string): string` di satu tempat (mis. `src/features/board/markdown.ts`) yang dipakai kedua file, supaya konsisten.

- [ ] **Step 3: Verifikasi**

```bash
pnpm exec tsc -b
pnpm build          # cek kenaikan bundle hanya ± ukuran dompurify (~20KB gz)
pnpm dev            # markdown masih render; <script>alert(1)</script> di deskripsi tidak tereksekusi
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/features/board/TaskDialog.tsx src/features/board/MarkdownEditor.tsx src/features/board/markdown.ts
git commit -m "feat(security): sanitize rendered markdown with DOMPurify (multi-user content)"
```

---

## Task 8: QA akhir + verifikasi + dokumentasi

**Files:**
- Modify: `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md`

- [ ] **Step 1: Typecheck** — `pnpm exec tsc -b` → exit 0.

- [ ] **Step 2: Production build** — `pnpm build` → exit 0, `dist/` hanya HTML/JS/CSS/woff2.

- [ ] **Step 3: Self-check util posisi** — `pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts` → semua `PASS` (regression guard; Fase 3 tak menyentuhnya).

- [ ] **Step 4: E2E manual — 2 akun Google** (`pnpm dev`, akun A = owner, akun B di incognito)

  1. A buat project P, buka board, klik **Members**, invite email B → baris `Pending` muncul, `Copy link` berfungsi.
  2. B login → project P otomatis muncul di daftar B dengan badge `Member` (klaim jalan).
  3. B buka P: bisa tambah/rename/hapus list, tambah/edit/pindah/hapus task. A me-refresh → melihat perubahan B.
  4. B: tidak ada tombol Edit/Delete pada kartu P di `/`; di board, dialog Members read-only + tombol `Leave project`.
  5. B coba (via devtools/network) `delete` project P atau `insert` `project_members` → ditolak RLS (403 / 0 baris).
  6. A: Members → Remove B → B refresh → P hilang dari daftar B; B buka `/projects/P` → kosong/redirect (RLS menolak).
  7. B di-invite ulang, accept, lalu B klik **Leave project** → P hilang dari daftar B; A masih punya P.
  8. Markdown: B tulis deskripsi task dengan `# H1` + `<script>alert(1)</script>` → A melihat H1 ter-render, script tidak jalan.

- [ ] **Step 5: RLS regresi (akun ketiga C)** — C bukan owner/member P → `/` tidak menampilkan P; query langsung `projects`/`lists`/`tasks`/`project_members` untuk `project_id = P` mengembalikan `[]`. Tidak ada error `infinite recursion detected in policy` di mana pun.

- [ ] **Step 6: Update `docs/PROGRESS.md`** — tambah `## Fase 3` dengan Task 0–8, tandai selesai; `Status: done` setelah semua hijau; catat Step 4–5 bila pending maintainer (butuh 2–3 akun Google).

- [ ] **Step 7: Update `CHANGELOG.md`**

```markdown
## [Fase 3] - <tanggal>
### Added
- Invite member ke project via email (owner)
- Undangan otomatis diterima saat login Google dengan email yang diundang
- Dialog kelola member: daftar member, badge role (Owner/Member), remove (owner), leave project (member)
- Badge Owner/Member pada daftar project; project yang dibagikan muncul untuk member

### Changed
- Otorisasi data kini berbasis keanggotaan (`project_members`), bukan lagi owner tunggal
- Deskripsi task (markdown) kini disanitasi sebelum dirender (DOMPurify) karena konten bisa dari member lain

### Security
- RLS ditulis ulang ke basis keanggotaan dengan fungsi `SECURITY DEFINER` anti-rekursi
- Hanya owner yang bisa hapus/rename project dan invite/remove member; ditegakkan di DB
```

- [ ] **Step 8: Update `docs/MEMORY.md`**

- **Key Decisions:** ganti butir "No `project_members` table" → "`project_members` + RLS berbasis keanggotaan sejak Fase 3, migrasi `20260906020000_project_members_rls.sql`. Rekursi `projects ↔ project_members` dicegah fungsi `SECURITY DEFINER` (`is_project_member` / `is_project_owner` / `shares_project_with`). Trigger `on_project_created` menambah baris owner. Klaim undangan lewat RPC `claim_pending_invites()` pada `SIGNED_IN`. Member boleh CRUD list+task; owner-only: hapus/rename project + invite/remove member."
- **Deferred:** hapus "Sanitasi HTML markdown (DOMPurify) ditunda ke Fase 3" dan "Invite member, multi-user RLS (`project_members`) — Fase 3". Tandai keduanya selesai.
- **Conventions:** tambah `src/features/members/` ke daftar feature folder.
- **Related Docs:** tambah spec + plan Fase 3.

- [ ] **Step 9: Commit final**

```bash
git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
git commit -m "docs: mark Fase 3 complete; update changelog and memory"
```

---

## Self-Review Notes

- **Spec coverage:** §4 data model → Task 1 §1. §5 RLS + fungsi anti-rekursi + trigger + backfill → Task 1 §2–9. §6 alur invite/klaim → Task 3. §7.1 MembersDialog → Task 4. §7.2 role-gating → Task 5 & 6. §7.3 sanitasi → Task 7. §8 types → Task 2. §9 dev rules → Task 8 Step 6–8 + file plan ini. §10 kriteria sukses → Task 8 Step 4–5.
- **Tidak menyentuh migrasi applied:** file baru `20260906020000_project_members_rls.sql`; `20260906000000_init_schema.sql` & `20260906010000_fractional_positions.sql` tidak diubah.
- **Anti-rekursi:** setiap policy yang butuh cek keanggotaan memanggil fungsi `SECURITY DEFINER`, tidak pernah query `project_members`/`projects` langsung dari dalam policy tabel lain.
- **Regression guard:** `reorderUtils.selfcheck.ts` tetap dijalankan di Task 8; drag&drop / fractional position / markdown editor tidak disentuh.
- **Urutan aman:** migrasi + types (Task 1–2) sebelum kode yang memakainya; klaim + hook role (Task 3) sebelum dialog (Task 4) sebelum wiring UI (Task 5–6); sanitasi (Task 7) independen; QA + docs (Task 8) terakhir.
- **Batasan PRD dijaga:** Google OAuth only (tidak ada perubahan provider), tanpa server email (Copy link manual), Supabase free tier (tak ada tabel/proses berat — satu tabel kecil + 5 fungsi SQL), bundle hanya +`dompurify`.

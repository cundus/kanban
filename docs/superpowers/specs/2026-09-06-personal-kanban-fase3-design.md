# Personal Kanban — Fase 3 (Invite Member + RLS Multi-User) Design Spec

> Sumber: `docs/PRD-Personal-Kanban-App.md` §4.2 (Invite Member), §4.3, §7.1 (data model), §9 Fase 3; daftar "Deferred" di `docs/MEMORY.md`
> Status: Disetujui untuk implementasi
> Prasyarat: Fase 2 sudah live (https://kanban.cundus.my.id), `position` sudah `double precision`

## 1. Ringkasan

Fase 3 mengubah app dari **single-owner** menjadi **multi-user berbasis keanggotaan**. Owner project bisa mengundang orang lain lewat email; orang yang diundang, saat login Google dengan email yang sama, otomatis jadi member `accepted` dan project muncul di daftar mereka. Role sederhana: `owner` (CRUD penuh + invite/remove member + hapus project) dan `member` (CRUD list & task, tidak bisa invite/remove/hapus project).

Perubahan inti ada di **database**: tabel baru `project_members`, beberapa fungsi helper `SECURITY DEFINER` untuk menghindari rekursi RLS, satu trigger owner-membership, dan penulisan ulang semua policy `projects`/`lists`/`tasks`/`profiles` dari basis `owner_id` ke basis keanggotaan. Di frontend: fitur baru `members/` (dialog kelola member), wiring klaim undangan saat login, dan role-gating tombol owner-only. `marked` output kini disanitasi (DOMPurify) karena konten deskripsi task bisa berasal dari member lain.

**Tanpa server email custom.** Alur undang memakai bagikan link manual sesuai PRD §4.2. Tetap Google OAuth saja. Supabase free tier. RLS ditegakkan di DB. Tidak menyentuh perilaku drag&drop / markdown / fractional position.

Di luar scope Fase 3: import/export JSON (Fase 4), realtime sync, role granular selain owner/member, notifikasi email otomatis.

## 2. Perubahan Tech Stack

| Area | Fase 2 | Fase 3 |
|---|---|---|
| Otorisasi data | RLS owner-only (`projects.owner_id = auth.uid()`) | RLS berbasis `project_members` + fungsi helper `SECURITY DEFINER` |
| Tabel | `profiles`, `projects`, `lists`, `tasks` | + `project_members` |
| Fungsi DB | hanya `handle_new_user()` | + `is_project_member`, `is_project_owner`, `shares_project_with`, `claim_pending_invites`, `handle_new_project` |
| Sanitasi HTML markdown | tidak ada (`marked` langsung ke `dangerouslySetInnerHTML`) | `dompurify` membungkus output `marked.parse` |
| Fitur frontend | `auth/`, `projects/`, `board/` | + `members/` |

Perkiraan bundle: `dompurify` ± 20 KB gzip (satu-satunya dependency baru; dipakai di dua titik render markdown). Tidak ada library UI baru — dialog memakai `@/components/ui/dialog` yang sudah ada.

## 3. Skema Baseline yang Ada Sekarang (hasil eksplorasi)

Dari `supabase/migrations/20260906000000_init_schema.sql` + `20260906010000_fractional_positions.sql`:

| Tabel | RLS sekarang |
|---|---|
| `profiles` | select/update/insert semua `auth.uid() = id`. **Tidak ada cara member lain melihat profil satu sama lain.** |
| `projects` | select/insert/update/delete semua `auth.uid() = owner_id`. |
| `lists` | 4 policy, semua `exists (select 1 from projects where projects.id = lists.project_id and projects.owner_id = auth.uid())`. |
| `tasks` | 4 policy, pola sama lewat `tasks.project_id`. |

Fungsi/trigger: `public.handle_new_user()` (`SECURITY DEFINER`) + trigger `on_auth_user_created` `after insert on auth.users` → membuat baris `profiles`.

`project_members` **belum ada** (dikonfirmasi `PGRST205` di `docs/PROGRESS.md` §"Live verification").

### Celah yang harus ditutup untuk multi-user

1. **Tidak ada tabel keanggotaan** → invite mustahil.
2. **RLS owner-only di mana-mana** → member yang diundang tidak bisa `select` project/list/task sama sekali.
3. **Rekursi RLS.** Kalau policy `projects` query `project_members` DAN policy `project_members` query `projects`, Postgres akan `infinite recursion detected in policy for relation`. Wajib dipecah lewat fungsi `SECURITY DEFINER`.
4. **Owner belum jadi baris `project_members`.** Perlu trigger `after insert on projects` + backfill untuk project lama, supaya satu sumber kebenaran keanggotaan.
5. **`profiles` tertutup.** Daftar member butuh nama/email/avatar member lain → perlu policy `select` untuk sesama anggota project.
6. **Klaim undangan** (`invited_email` ↔ email akun Google) belum ada jalurnya.
7. **Sanitasi markdown.** `docs/MEMORY.md` sudah mencatat DOMPurify ditunda ke Fase 3 justru karena titik ini: konten task kini bisa ditulis member lain.

## 4. Data Model — `project_members`

Mengikuti PRD §7.1:

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `project_id` | uuid not null → `projects(id)` `on delete cascade` | |
| `user_id` | uuid null → `auth.users(id)` `on delete cascade` | null selama `pending`, terisi saat klaim |
| `invited_email` | text not null | email yang diundang (disimpan lowercase saat insert dari client) |
| `role` | text not null default `'member'` check in (`'owner'`,`'member'`) | |
| `status` | text not null default `'pending'` check in (`'pending'`,`'accepted'`) | |
| `created_at` | timestamptz not null default `now()` | |
| `accepted_at` | timestamptz null | diisi saat klaim / oleh trigger owner |

Index:
- unique `(project_id, lower(invited_email))` — satu email satu undangan per project.
- unique `(project_id, user_id) where user_id is not null` — satu user satu baris per project.
- index biasa `(user_id) where user_id is not null` dan `(lower(invited_email))` untuk performa policy/klaim.

`on delete cascade` dari `projects` memastikan hapus project ikut menghapus baris member; tidak perlu policy DELETE khusus untuk kasus itu.

## 5. Desain RLS

### 5.1 Fungsi helper (`SECURITY DEFINER`) — kunci anti-rekursi

Di Supabase, fungsi yang dibuat via migrasi dimiliki `postgres` (punya `BYPASSRLS`). Fungsi `SECURITY DEFINER` berjalan sebagai pemilik → query internalnya **tidak** kena RLS lagi → tidak ada rekursi `projects ↔ project_members`. Semua di-set `search_path` eksplisit dan hak `execute` hanya untuk role `authenticated`.

| Fungsi | Sifat | Isi ringkas |
|---|---|---|
| `public.is_project_member(p_project uuid) → boolean` | `stable` | ada baris `project_members` dgn `project_id = p_project`, `user_id = auth.uid()`, `status = 'accepted'` |
| `public.is_project_owner(p_project uuid) → boolean` | `stable` | ada baris `projects` dgn `id = p_project`, `owner_id = auth.uid()` |
| `public.shares_project_with(p_user uuid) → boolean` | `stable` | ada satu project di mana `auth.uid()` dan `p_user` sama-sama member `accepted` |
| `public.claim_pending_invites() → integer` | `volatile` | `update project_members set user_id = auth.uid(), status='accepted', accepted_at=now()` untuk baris `pending` dgn `lower(invited_email) = lower(auth.jwt()->>'email')`; return jumlah baris |

`claim_pending_invites()` sengaja `SECURITY DEFINER` sehingga tidak butuh policy `UPDATE` di `project_members` untuk klaim — client cukup panggil RPC.

### 5.2 Trigger owner-membership

`public.handle_new_project()` (`SECURITY DEFINER`) + trigger `on_project_created` `after insert on projects`: insert baris `project_members (project_id=new.id, user_id=new.owner_id, invited_email=<email owner>, role='owner', status='accepted', accepted_at=now())`. Alasan pola trigger (bukan insert dari client): tidak bisa terlewat, konsisten dengan `handle_new_user()` baseline, dan menghindari policy `INSERT` longgar untuk baris owner.

### 5.3 Policy per tabel (sesudah migrasi)

| Tabel / aksi | Policy |
|---|---|
| `project_members` SELECT | `is_project_member(project_id)` OR `is_project_owner(project_id)` OR `lower(invited_email) = lower(auth.jwt()->>'email')` — anggota melihat roster; yang diundang melihat undangannya sendiri |
| `project_members` INSERT | `is_project_owner(project_id)` AND `role = 'member'` AND `status = 'pending'` — hanya owner mengundang; baris owner datang dari trigger |
| `project_members` DELETE | (`is_project_owner(project_id)` AND `role <> 'owner'`) — owner remove member; OR (`user_id = auth.uid()` AND `role <> 'owner'`) — member "leave project". Baris owner tak bisa dihapus manual (hanya cascade saat project dihapus) |
| `project_members` UPDATE | **tidak ada** — klaim lewat `claim_pending_invites()`; tak ada jalur update lain di Fase 3 |
| `projects` SELECT | `owner_id = auth.uid()` OR `is_project_member(id)` |
| `projects` INSERT | **dipertahankan** dari baseline: `owner_id = auth.uid()` |
| `projects` UPDATE | `owner_id = auth.uid()` (owner-only) |
| `projects` DELETE | `owner_id = auth.uid()` (owner-only) |
| `lists` SELECT/INSERT/UPDATE/DELETE | `is_project_member(project_id)` — owner ikut tercakup karena punya baris owner `accepted` (trigger + backfill) |
| `tasks` SELECT/INSERT/UPDATE/DELETE | `is_project_member(project_id)` |
| `profiles` SELECT | tambah policy: `id = auth.uid()` OR `shares_project_with(id)` (policy "Users can view own profile" lama tetap ada; policy permissive di-OR) |

Keputusan: **member boleh CRUD list & task** (bukan hanya task). Board Kanban kolaboratif — membatasi pembuatan/rename/hapus list ke owner saja membuat member tidak bisa menata papan. PRD §4.2 menyebut member = "CRUD task"; ini pelonggaran sadar yang dicatat di `MEMORY.md`. Yang tetap owner-only: hapus/rename **project** dan invite/remove **member**.

### 5.4 Backfill project lama

`insert into project_members (…) select p.id, p.owner_id, coalesce(pr.email,''), 'owner','accepted', now() from projects p left join profiles pr on pr.id = p.owner_id on conflict do nothing;` — supaya owner project yang dibuat sebelum Fase 3 tetap lolos policy `is_project_member`.

### 5.5 Keamanan migrasi terhadap data live

- Semua `create policy` baru didahului `drop policy` eksplisit atas policy lama yang digantikan — tidak ada policy yatim.
- `project_members` dibuat dengan RLS `enable` sejak awal; tidak ada jendela tanpa proteksi.
- Perubahan bersifat aditif untuk data (tabel baru + backfill), tidak ada kolom di-drop, tidak menyentuh `position` atau skema `lists`/`tasks`.
- Dijalankan via `scripts/migrate.mjs` (session pooler ap-southeast-1) seperti migrasi Fase 2 — DDL `create policy` / `create function` aman lewat session pooler (bukan transaction pooler).

## 6. Alur Invite / Accept (tanpa server email)

1. Owner buka **Members dialog** dari header `BoardPage` → input email → submit.
2. Client: `insert into project_members (project_id, invited_email=lower(email), role='member', status='pending')`. Policy INSERT memvalidasi pemanggil adalah owner.
3. Dialog menampilkan baris **Pending** + tombol **Copy invite link** (`https://kanban.cundus.my.id/projects/:id`). Owner bagikan link manual (WA/chat) — sesuai PRD §4.2 poin 2.
4. Orang yang diundang login Google dengan email itu. Di `useAuth`, pada event `SIGNED_IN`, client memanggil `supabase.rpc('claim_pending_invites')` lalu `invalidateQueries(['projects'])`.
5. Baris pending mereka jadi `accepted`, `user_id` terisi. Project langsung muncul di daftar `/` dan link `/projects/:id` bisa dibuka.
6. **Edge:** invitee membuka `/projects/:id` sebelum login → `AuthGuard` redirect ke `/login` → sesudah login, klaim jalan → arahkan kembali (simpan `location.pathname` yang dituju; nice-to-have, boleh menyusul).

## 7. Desain UI

### 7.1 `MembersDialog` (`src/features/members/MembersDialog.tsx`)

Dipicu tombol **"Members"** di header `BoardPage` (sebelah "Back to projects").

- **Header:** "Members — <nama project>".
- **Baris tambah (owner-only):** `Input` email + `Button` "Invite". Validasi email sederhana; disable saat kosong. Sukses → toast + baris pending muncul.
- **Daftar member:** tiap baris = avatar (fallback inisial), nama (atau `invited_email` bila pending), email, badge role.
  - Badge: `Owner` (variant solid) / `Member` (variant outline). Baris pending: badge abu-abu `Pending`.
  - **Owner-only per baris:** tombol `Remove` (ikon ✕) untuk baris `role = 'member'` — dengan `confirm()` sederhana. Tidak ada tombol Remove pada baris owner.
  - **Untuk member yang melihat dialog:** tombol `Leave project` di footer (kecuali owner). Konfirmasi.
- **Pending section:** baris pending menampilkan email + `Pending` + tombol `Copy link` + (owner-only) `Cancel invite` (= DELETE baris).
- Non-owner melihat daftar read-only (tanpa Invite / Remove), plus `Leave project`.

### 7.2 Role-gating lain

- `BoardPage`: tombol "Members" selalu tampil. Kontrol hapus **list** tetap tersedia untuk semua member (lihat §5.3). Tidak ada kontrol project-level di sini.
- `ProjectListPage` / `ProjectCard`: tampilkan badge `Owner` / `Member` per kartu. Sembunyikan tombol **Edit** dan **Delete** untuk project di mana user bukan owner. Tombol **Open** tetap.
- `useProjects`: urutkan owned dulu lalu shared (opsional, kualitas hidup), atau biarkan `created_at desc` — putuskan saat implementasi, jangan menambah query kedua.

### 7.3 Sanitasi markdown

- Dependency `dompurify`.
- Titik render HTML: `TaskDialog` (mode view) dan `MarkdownEditor` (panel preview). Bungkus: `DOMPurify.sanitize(marked.parse(md) as string)`.
- Tidak mengubah UX editor; hanya mem-filter output. Catat di `MEMORY.md` bahwa item "Deferred: Sanitasi HTML markdown (DOMPurify)" sudah ditangani.

## 8. Perubahan Types

`src/types/database.types.ts` (hand-written; Supabase CLI belum terpasang — lihat `docs/MEMORY.md`):

- Tambah `Tables.project_members` dengan `Row` / `Insert` / `Update` / `Relationships: []`.
- Isi `Functions` (sekarang `Record<string, never>`) dengan tanda tangan `is_project_member`, `is_project_owner`, `shares_project_with`, `claim_pending_invites` (Args + Returns) — cukup untuk `supabase.rpc('claim_pending_invites')` bertipe.
- Pertahankan komentar `ponytail:` di baris atas; `Views` tetap `Record<string, never>`.
- Verifikasi `pnpm exec tsc -b` exit 0.

## 9. Development Rules — Kelanjutan (lanjutan spec Fase 1 §7, Fase 2 §9)

- **Plan Fase 3:** `docs/superpowers/plans/2026-09-06-personal-kanban-fase3-invite-member.md` (task-by-task: file path, SQL/kode lengkap, cara test).
- **`docs/PROGRESS.md`:** tambah section `## Fase 3`, update tiap task selesai (bukan di-batch).
- **`CHANGELOG.md`:** entry `## [Fase 3] - <tanggal>` dari sudut pandang user-facing.
- **`docs/MEMORY.md`:** catat — `project_members` + RLS keanggotaan sudah ada, pola fungsi `SECURITY DEFINER` anti-rekursi, trigger owner-membership, member boleh CRUD list+task, DOMPurify sudah masuk (hapus dari Deferred), klaim undangan lewat RPC saat login.
- **Migrasi:** JANGAN sunting `20260906000000_init_schema.sql` atau `20260906010000_fractional_positions.sql`. File baru `supabase/migrations/20260906020000_project_members_rls.sql`.
- **Regression guard:** `reorderUtils.selfcheck.ts` tetap wajib hijau sebelum commit yang menyentuh util posisi (Fase 3 tidak menyentuhnya, tapi tetap dijalankan di QA).

## 10. Kriteria Sukses Fase 3

- Owner bisa mengundang email; baris `pending` dibuat; link bisa disalin.
- Invitee login Google dgn email itu → otomatis `accepted`, project muncul di daftarnya, board bisa dibuka.
- Member bisa CRUD list & task di project itu; perubahan terlihat oleh owner.
- Member **tidak** bisa: hapus/rename project, invite/remove member (ditolak RLS + UI menyembunyikan kontrol).
- Owner bisa remove member → akses member ke project/list/task langsung hilang (RLS).
- Member bisa "Leave project" sendiri.
- RLS 2 akun: user C (bukan member) tetap tidak melihat apa pun dari project itu; tidak ada regresi isolasi Fase 1/2.
- Tidak ada error `infinite recursion detected in policy`.
- `marked` output disanitasi DOMPurify di kedua titik render.
- `tsc -b` 0 error; `pnpm build` output static-only; bundle bertambah hanya ± ukuran `dompurify`.
- `PROGRESS.md` / `CHANGELOG.md` / `MEMORY.md` terupdate sesuai §9.

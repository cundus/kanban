# Changelog

## [Fase 6.2] - 2026-09-08
### Added
- Label pada task — tabel baru `labels` (per-project) + `task_labels` (composite PK `task_id`+`label_id`, RLS via `is_project_member()`)
- Baris pill label berwarna di task card, di atas avatar stack
- Chip picker label di task dialog — klik chip untuk toggle instan, tanpa tombol Save
- Dialog "Labels" — kelola label project (create/edit warna & nama/delete), dibuka dari menu `...` header board
- Komponen `LabelBadge` baru (`src/components/ui/label-badge.tsx`) — pill dengan warna bebas (native `<input type="color">`) dan kontras teks otomatis berbasis luminance

### Notes
- Tidak ada dependency baru
- RLS pakai helper `is_project_member()` yang sama sejak awal (bukan raw join `project_members`) — belajar dari celah keamanan Fase 6.1
- `useTaskLabels` meniru persis pola batch-fetch-then-merge `useTaskAssignees` — pola standar untuk fitur many-to-many task-scoped berikutnya
- Warna label pakai color picker bebas, bukan palet tetap, atas pilihan eksplisit user
- Di luar scope: filter by label, label bawaan/preset, batasan jumlah label per task

### Status
- Kode selesai di `main`, semua 7 task + QA APPROVED lewat subagent-driven development. Belum di-push/deploy. Sisa pending maintainer: E2E manual, push ke `origin/main`

## [Fase 6.1] - 2026-09-08
### Added
- Multi-assignee pada task — tabel baru `task_assignees` (composite PK `task_id`+`user_id`, RLS via `is_project_member()`)
- Avatar stack di task card — maks 3 avatar bertumpuk + badge `+N` untuk sisanya
- Chip picker assignee di task dialog — klik chip nama member untuk assign/unassign instan, tanpa tombol Save
- Komponen `Avatar` baru (`src/components/ui/avatar.tsx`) — foto profil atau inisial dengan warna hash deterministik per nama

### Notes
- Tidak ada dependency baru
- `useToggleAssignee` tidak optimistic (beda dari `useArchiveTask` Fase 5) — tunggu konfirmasi server sebelum invalidate cache
- `TaskCard` dan `TaskDialog` sama-sama memanggil `useTaskAssignees(projectId)` secara independen — React Query men-dedupe fetch lewat queryKey yang sama, tanpa perlu prop-drilling
- Migrasi `20260908010000_task_assignees.sql` + `20260908011000_task_assignees_rls_fix.sql` **sudah di-apply** ke DB live
- Di luar scope: filter by assignee, notifikasi, batasan single-assignee

### Status
- Kode selesai di `main`, semua 6 task + QA APPROVED lewat subagent-driven development. Belum di-push/deploy. Sisa pending maintainer: E2E manual, push ke `origin/main`

## [Fase 5] - 2026-09-08
### Added
- Menu aksi `...` pada task card (Duplicate, Archive, Delete) — context-menu klik-kanan di desktop, tombol dropdown di mobile
- Menu aksi `...` pada list column (Rename, Add task to top, Delete)
- Archive task: soft-delete via kolom `tasks.archived_at`, task terarsip hilang dari board tapi bisa dipulihkan
- Dialog "Task Terarsip" — daftar task yang di-archive, tombol Restore per task, Delete permanen (dengan konfirmasi)
- Duplicate task — salinan langsung di list yang sama, posisi setelah task asal
- Task dialog kini mendukung deep-link `?task=<id>` di URL — bisa dibagikan/refresh tanpa kehilangan dialog yang terbuka
- Autosave per-field pada task dialog (title/description tersimpan otomatis saat blur, tanpa tombol Save)
- Footer metadata pada task dialog: "Dibuat oleh {nama}" + "Terakhir diubah {relatif}"

### Changed
- Task dialog diperlebar jadi layout 2 kolom (`dialog.tsx` dapat CVA `size` prop: `default`/`lg`)
- Header board dikonsolidasi — tombol Members + Export digabung jadi satu menu `...`, ditambah item Archived
- Rename task dari context-menu kini auto-focus ke field title saat dialog terbuka

### Notes
- Migrasi `archived_at` (kolom + partial index `tasks_active_by_list_idx`) — **belum di-apply ke DB live**, pending maintainer
- Archive bersifat optimistic (rollback + toast bila gagal); Duplicate/Restore/Delete permanen tidak optimistic (tunggu konfirmasi server)
- Tidak ada dependency baru — semua primitif menu (`MenuSubmenu`, context-menu) dibangun di atas `@base-ui/react` yang sudah ada
- Long-press context-menu di mobile punya keterbatasan diketahui: dnd-kit `TouchSensor` menang atas long-press base-ui context-menu (didokumentasikan sebagai limitation, bukan bug) — makanya mobile pakai tombol dropdown terpisah, bukan long-press

### Status
- Kode selesai di branch `feat/fase5-task-actions`, semua 9 task + final QA APPROVED lewat subagent-driven development. **Belum di-merge ke `main`, belum di-deploy.** Sisa pending maintainer: apply migrasi live, E2E manual, merge + deploy

## [Fase 4] - 2026-09-07
### Added
- Export project ke file JSON dari header board (owner & member) — project + list + task + metadata versi/timestamp, diunduh langsung di browser
- Import file JSON hasil export → membuat project baru milik user yang meng-import, dengan validasi berbahasa Indonesia dan pesan error yang jelas

### Notes
- 100% di client — tidak ada beban tambahan di VPS/Supabase, tidak ada migrasi DB, tidak ada dependency baru
- Import selalu membuat project baru (tidak menimpa / merge). ID lama tidak dipertahankan; owner/created_by = user yang meng-import
- Deskripsi markdown hasil import tetap disanitasi DOMPurify pada render (jalur `renderMarkdown` yang sama); nama project/list/task dirender sebagai teks
- Kegagalan di tengah import melakukan rollback (project yang terlanjur dibuat dihapus, cascade membersihkan list/task)

### Status deploy (update 2026-09-07)
- Branch di-merge ke `main` (`77dfa71`) dan auto-deploy live via webhook — **https://kanban.cundus.my.id** HTTP 200, bundle `index-D5xNrsS_.js`
- Tanpa migrasi DB, tanpa dependency baru. Sisa pending maintainer: E2E manual import/export (export owner/member, round-trip import, validasi, rollback)

## [Fase 3] - 2026-09-06 / 2026-09-07
### Added
- Invite member ke project lewat email (owner). Tanpa server email — owner membagikan link undangan manual
- Undangan otomatis diterima saat orang yang diundang login Google dengan email yang sama (RPC `claim_pending_invites` pada `SIGNED_IN`)
- Dialog kelola member: daftar member, badge role Owner/Member/Pending, remove member (owner), cancel invite + copy link (owner), leave project (member)
- Badge Owner/Member pada daftar project; project yang dibagikan kini muncul untuk member

### Changed
- Otorisasi data kini berbasis keanggotaan (`project_members`), bukan lagi owner tunggal. Member boleh CRUD list & task; owner-only tetap: hapus/rename project + invite/remove member
- Deskripsi task (markdown) kini disanitasi dengan DOMPurify sebelum dirender, karena konten bisa berasal dari member lain

### Security
- RLS ditulis ulang ke basis keanggotaan dengan fungsi `SECURITY DEFINER` anti-rekursi (`is_project_member`, `is_project_owner`, `shares_project_with`), trigger `on_project_created` untuk baris owner, dan backfill project lama
- Hanya owner yang bisa hapus/rename project dan invite/remove member — ditegakkan di DB (RLS) dan disembunyikan di UI

### Status deploy (update 2026-09-07)
- Migrasi `20260906020000_project_members_rls.sql` **sudah di-apply** ke Supabase live (`pnpm migrate:up`, 3/3 di `schema_migrations`); backfill owner project lama OK
- Branch di-merge ke `main` (`41b196e`) dan auto-deploy live via webhook — **https://kanban.cundus.my.id** HTTP 200, bundle `index-DVijB2h6.js`
- Sisa pending maintainer: E2E 2 akun Google (invite → claim otomatis) & regresi RLS 3 akun (cek bebas `infinite recursion`)

## [Fase 2] - 2026-09-06
### Added
- Drag & drop task antar kolom dan reorder dalam kolom (@dnd-kit)
- Drag & drop untuk mengurutkan kolom/list
- Editor markdown deskripsi task: mode Write / Preview / Split
- Toast error (sonner) untuk kegagalan aksi board

### Changed
- Urutan list/task kini memakai fractional index (double precision) — satu drag hanya meng-update 1–2 baris
- Perpindahan task/list bersifat optimistic dengan rollback saat gagal

### Removed
- Tombol reorder ↑/↓ pada task dan list (digantikan drag & drop)

### Deployed
- Fase 2 code merged to `main` (`98121b0`) and auto-deployed live on 2026-09-06 via the VPS webhook
  (push to `main` → pull, `pnpm install --frozen-lockfile`, `pnpm build`, rsync into the web root)
- DB migration `supabase/migrations/20260906010000_fractional_positions.sql` is now **applied** to the
  live Supabase project on 2026-09-06 via `scripts/migrate.mjs` (session pooler ap-southeast-1);
  `lists.position` and `tasks.position` are `double precision` on the live database
- Live at https://kanban.cundus.my.id — deployed bundle `index-BbItJkpg.js`

## [Fase 1] - 2026-09-06
### Added
- Login via Google (Supabase Auth)
- Project CRUD (create/read/update/delete)
- List CRUD with manual up/down reordering
- Task CRUD with manual up/down reordering
- Task description supports Markdown (edit as raw text, rendered as HTML when viewing)

### Deployed
- Supabase project provisioned, Google OAuth enabled, and `20260906000000_init_schema.sql`
  (tables + RLS policies) applied to the live database
- GitHub Actions workflow added (`.github/workflows/deploy.yml`), but it does not run: the account is
  locked for billing, so every job fails before its first step. Correct as written; resumes when that clears
- Auto deploy instead runs as a webhook on the VPS: push to `main` triggers pull, install, build, and an
  rsync into the web root, in about 8 seconds. The existing single-project webhook server was extended to
  route by URL path, moved out of the other project's git repo, and had its secrets moved from the
  world-readable systemd unit into a 0600 environment file
- A local, gitignored PowerShell script remains as the manual fallback
- Both deploy paths force 755/644 on the web root, since rsync/scp inherit an umask that had left the
  files unreadable by nginx
- Live at https://kanban.cundus.my.id — static files only, no backend process on the VPS

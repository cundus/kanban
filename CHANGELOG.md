# Changelog

## [Fase 4] - 2026-09-07
### Added
- Export project ke file JSON dari header board (owner & member) — project + list + task + metadata versi/timestamp, diunduh langsung di browser
- Import file JSON hasil export → membuat project baru milik user yang meng-import, dengan validasi berbahasa Indonesia dan pesan error yang jelas

### Notes
- 100% di client — tidak ada beban tambahan di VPS/Supabase, tidak ada migrasi DB, tidak ada dependency baru
- Import selalu membuat project baru (tidak menimpa / merge). ID lama tidak dipertahankan; owner/created_by = user yang meng-import
- Deskripsi markdown hasil import tetap disanitasi DOMPurify pada render (jalur `renderMarkdown` yang sama); nama project/list/task dirender sebagai teks
- Kegagalan di tengah import melakukan rollback (project yang terlanjur dibuat dihapus, cascade membersihkan list/task)

### Status deploy
- **Belum di-deploy.** Kode selesai di branch `fase4-import-export` (`tsc -b` / `pnpm build` / self-check 13+17 PASS / lint hijau). Belum di-merge ke `main`
- Pending maintainer: E2E manual (export owner/member, round-trip import, XSS nama/markdown, 5 kasus validasi, rollback, regresi RLS akun ketiga), lalu merge + deploy. Tidak ada migrasi untuk di-apply

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

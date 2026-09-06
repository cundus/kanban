# Changelog

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

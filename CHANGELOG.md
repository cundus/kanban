# Changelog

## [Fase 3] - 2026-09-06
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

### Pending
- Kode selesai di branch `fase3-invite-member`. Migrasi `supabase/migrations/20260906020000_project_members_rls.sql` **belum di-apply** ke Supabase live; branch belum di-merge. Deploy + apply migrasi menyusul (pending maintainer, butuh `DATABASE_URL` + 2–3 akun Google untuk E2E/RLS)

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

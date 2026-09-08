# Progress Tracker

## Fase 1 — MVP
Plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase1-mvp.md
Status: **deployed to production** — https://kanban.cundus.my.id

- [x] Task 0: Prerequisites (Supabase project + Google OAuth)
- [x] Task 1: Scaffold Vite + React + TypeScript
- [x] Task 2: Tailwind v4 + shadcn/ui
- [x] Task 3: Remaining dependencies
- [x] Task 4: Environment variables
- [x] Task 5: Database types
- [x] Task 6: Supabase client
- [x] Task 7: TanStack Query client
- [x] Task 8: Database migration + RLS (written **and** applied to the live project)
- [x] Task 9: Reorder utility + self-check
- [x] Task 10: Auth feature
- [x] Task 11: App shell + routing
- [x] Task 12: shadcn components
- [x] Task 13: Projects feature
- [x] Task 14: Board feature — lists
- [x] Task 15: Board feature — tasks
- [x] Task 16: BoardPage assembly
- [x] Task 17: Documentation scaffolding
- [ ] Task 18: Final verification
  - [x] Typecheck (`tsc -p tsconfig.app.json --noEmit`) — 0 errors
  - [x] Production build (`pnpm build`) — succeeds, static-only output in `dist/`
  - [x] Reorder self-check — 4/4 PASS
  - [x] Manual E2E walkthrough — **done by master on 6 Sep 2026** (Google login → project → list → task → markdown)
  - [ ] RLS isolation check (two accounts) — **partially verified**, see below

## Fase 2 — Drag & Drop + Markdown Editor
Plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase2-dnd-markdown.md
Spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase2-design.md
Status: **kode selesai — di-merge ke `main` (commit `98121b0`) dan ter-deploy live via webhook pada 2026-09-06 (https://kanban.cundus.my.id, bundle `index-BbItJkpg.js`). Migrasi DB live sudah di-apply pada 2026-09-06. Sisa pending: E2E manual (Task 8 Step 4) & RLS 2-akun (Task 8 Step 5)**

- [x] Task 0: Prasyarat (verifikasi baseline, branch kerja)
- [x] Task 1: Dependencies (@dnd-kit + sonner) + mount Toaster
- [x] Task 2: Migrasi fractional position (double precision) + regen types
  - Step 1,3-5 selesai: file migrasi `20260906010000_fractional_positions.sql` ditulis, `database.types.ts` diperbarui manual (Supabase CLI tidak terpasang, `position` tetap `number`), `tsc -b` exit 0, commit `feat: migrate list/task position to fractional double precision`.
  - Step 2 selesai — migrasi sudah di-apply ke live Supabase project pada 2026-09-06 via `pnpm migrate baseline init` + `pnpm migrate:up` (session pooler aws-0-ap-southeast-1, port 5432); terverifikasi kolom `lists.position` & `tasks.position` kini `double precision`.
- [x] Task 3: Utilitas fractional index + self-check
- [x] Task 4: Refactor query task ke project scope
- [x] Task 5: Wiring optimistic di board hooks (useMoveTask, useReorderList)
- [x] Task 6: UI drag & drop board (cross-list + within-list + reorder list)
- [x] Task 7: Komponen Markdown editor (write/preview/split)
- [x] Task 8: QA akhir + verifikasi + update PROGRESS/CHANGELOG/MEMORY
  - [x] Step 1: Typecheck (`pnpm exec tsc -b`) — exit 0
  - [x] Step 2: Production build (`pnpm build`) — exit 0, `dist/` hanya `index.html` + `assets/` (JS/CSS/woff2)
  - [x] Step 3: Self-check util posisi (`pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts`) — 13/13 PASS, exit 0
  - [ ] Step 4: Walkthrough E2E manual (`pnpm dev`) — **pending maintainer**: butuh browser + sesi login, belum dijalankan agen.
  - [ ] Step 5: RLS regresi 2 akun Google — **pending maintainer**: butuh dua akun Google + incognito, belum dijalankan agen.
  - [x] Step 6-9: PROGRESS/CHANGELOG/MEMORY diperbarui, commit final dibuat.

## Fase 3 — Invite Member + RLS Multi-User
Plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase3-invite-member.md
Spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase3-design.md
Status: **deployed to production pada 2026-09-07** — migrasi `20260906020000_project_members_rls.sql` sudah di-apply ke DB live (3/3 di `schema_migrations`, backfill owner OK), branch di-merge ke `main` (`41b196e`) dan auto-deploy live via webhook (bundle `index-DVijB2h6.js`, HTTP 200). Sisa pending maintainer: E2E manual 2 akun (Task 8 Step 4) & regresi RLS 3 akun (Task 8 Step 5).

- [x] Task 0: Prasyarat (baca spec/PRD/MEMORY, baseline hijau, branch kerja)
- [x] Task 1: Migrasi `project_members` + fungsi `SECURITY DEFINER` + trigger owner-membership + backfill + RLS rewrite (`supabase/migrations/20260906020000_project_members_rls.sql`, commit `20cb97c`) — file ditulis & di-review; **apply ke DB live belum dijalankan** (butuh `DATABASE_URL`, pending maintainer)
- [x] Task 2: Regen types manual — `project_members` Row/Insert/Update + signature fungsi RLS di `src/types/database.types.ts` (commit `18a7a1a`)
- [x] Task 3: Klaim undangan saat `SIGNED_IN` (`claim_pending_invites` RPC) + `useMembership(projectId)` role hook (commit `f172c27`)
- [x] Task 4: Fitur `members/` — `useMembers` (invite/remove/leave) + `MembersDialog` (commit `247149d`)
- [x] Task 5: `BoardPage` — tombol Members + dialog di header, `useProject` ringan (commit `b95b33a`)
- [x] Task 6: Daftar project — badge Owner/Member, sembunyikan Edit/Delete pada project shared (commit `aa95299`)
- [x] Task 7: Sanitasi markdown DOMPurify — helper `src/features/board/markdown.ts` (`renderMarkdown`) dipakai `TaskDialog` view + `MarkdownEditor` preview (commit `6259a03`)
- [ ] Task 8: QA akhir + verifikasi + dokumentasi
  - [x] Step 1: Typecheck (`pnpm exec tsc -b`) — exit 0
  - [x] Step 2: Production build (`pnpm build`) — exit 0, `dist/` static-only, bundle `index-BE1SbpUL.js` 252.60 kB (gzip 82.21 kB)
  - [x] Step 3: Self-check util posisi (`pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts`) — 13/13 PASS
  - [ ] Step 4: E2E manual 2 akun Google (owner + invitee) — **pending maintainer**: butuh akun Google kedua + incognito
  - [ ] Step 5: Regresi RLS live (akun ketiga, cek tidak ada `infinite recursion detected in policy`) — **pending maintainer**: butuh migrasi ter-apply ke DB live + 3 akun
  - [x] Step 6-9: PROGRESS/CHANGELOG/MEMORY diperbarui, commit dokumentasi dibuat
- [x] Apply migrasi `20260906020000_project_members_rls.sql` ke Supabase live — **selesai 2026-09-07** via `pnpm migrate:up` (session pooler aws-0-ap-southeast-1); terverifikasi tabel `project_members`, fungsi `is_project_member`/`is_project_owner`/`claim_pending_invites`, dan backfill owner project lama (`pcinta0@gmail.com` → owner/accepted)
- [x] Merge `fase3-invite-member` → `main` + deploy — **selesai 2026-09-07** (`59b767a..41b196e` fast-forward, push `main` → auto-deploy webhook, HTTP 200, bundle `index-DVijB2h6.js`)

## Fase 4 — Import & Export JSON
Plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase4-import-export.md
Spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase4-design.md
Status: **deployed to production pada 2026-09-07** — branch di-merge ke `main` (`77dfa71`) dan auto-deploy live via webhook (bundle `index-D5xNrsS_.js`, HTTP 200). **Tanpa migrasi DB, tanpa perubahan RLS/`database.types.ts`, tanpa dependency baru.** Sisa pending maintainer: E2E manual import/export (Task 6 Step 5).

- [x] Task 0: Prasyarat (baca spec/PRD/MEMORY, baseline hijau, branch `fase4-import-export`) — asumsi kerja A1–A8 dipakai (Spec §11 belum dijawab maintainer)
- [x] Task 1: Format export + `buildExport()` murni + `exportFileName()` (`src/features/import-export/exportFormat.ts`, commit `befdc01`)
- [x] Task 2: `validateImport`/`normalizeImport` murni + self-check 17 PASS (`importValidation.ts` + `importValidation.selfcheck.ts`, commit `5f3d75a`)
- [x] Task 3: `useExportProject` + tombol "Export JSON" di header board, owner & member (tanpa role-gating) (`useExportProject.ts`, `BoardPage.tsx`, commit `ff49840`)
- [x] Task 4: `useImportProject` — insert project baru + loop list + batch task, rollback-by-delete saat gagal di tengah (`useImportProject.ts`, commit `4f244d1`)
- [x] Task 5: `ImportDialog` (file picker + batas 2 MB + error Bahasa Indonesia + ringkasan) + tombol "Import" di daftar project (`ImportDialog.tsx`, `ProjectListPage.tsx`, commit `f3ddae8`)
- [x] Task 6: QA akhir + verifikasi + dokumentasi
  - [x] Step 1: Typecheck `pnpm exec tsc -b` — exit 0
  - [x] Step 2: Production build `pnpm build` — exit 0, `dist/` hanya `index.html` + `assets/`, bundle tidak bertambah (tanpa library baru)
  - [x] Step 3: Self-check — `reorderUtils.selfcheck.ts` 13/13 PASS (regression guard), `importValidation.selfcheck.ts` 17/17 PASS
  - [x] Step 4: Lint `pnpm lint` (oxlint) — tidak ada error baru
  - [ ] Step 5: E2E manual (export owner/member, round-trip import, nama sebagai teks, validasi 5 kasus, rollback, regresi RLS akun ketiga) — **pending maintainer**: butuh browser + sesi login + ≥ 2 akun Google + akses Supabase dashboard
  - [x] Step 6-9: PROGRESS/CHANGELOG/MEMORY diperbarui, commit dokumentasi dibuat
- [x] Merge `fase4-import-export` → `main` + deploy — **selesai 2026-09-07** (`65dfb05..77dfa71` fast-forward, push `main` → auto-deploy webhook, HTTP 200, bundle `index-D5xNrsS_.js`; tanpa migrasi DB)

## Fase 5 — Task Actions (Duplicate/Archive/Delete) + Task Dialog Upgrade
Plan: docs/superpowers/plans/2026-09-08-personal-kanban-fase5-task-actions.md
Spec: docs/superpowers/specs/2026-09-08-personal-kanban-fase5-design.md
Status: **kode selesai di branch `feat/fase5-task-actions`, belum di-merge ke `main`, belum di-deploy.** Semua 9 task diimplementasi lewat subagent-driven development (implementer → controller re-verify → reviewer independen), semua APPROVED.

- [x] Task 0-1: Migrasi `tasks.archived_at` + partial index `tasks_active_by_list_idx` + regen `database.types.ts` (commit `66f154f`)
- [x] Task 2: `useTasks.ts` filter task aktif, hooks `useDuplicateTask`/`useArchiveTask` (optimistic)/`useRestoreTask`/`useDeleteTask` (commit `fab58aa`)
- [x] Task 3: `MenuSubmenu` primitive + `context-menu.tsx` wrapper di `src/components/ui/` (commit `7654bc7`)
- [x] Task 4: `TaskActionsMenu.tsx` — menu `...` (Duplicate/Archive/Delete) dipakai task card & dialog header (commit `db88c45`)
- [x] Task 5: `ListActionsMenu.tsx` + `useCreateTask` param posisi + `ListColumn.tsx` (add-to-top, hapus tombol delete berdiri sendiri) (commit `c4a8eb6`)
- [x] Task 6: `TaskCard.tsx` dibungkus `TaskActionsMenu` — varian context-menu (desktop) + dropdown tombol (mobile) (commit `d241810`)
- [x] Task 7: `TaskDialog.tsx` upgrade — autosave per-field saat blur, layout 2 kolom, `dialog.tsx` CVA `size` prop (`default`/`lg`), footer metadata "Dibuat oleh / Terakhir diubah" (commit `660c89e`)
- [x] Task 8: `BoardPage.tsx` deep-link `?task=<id>` via `useSearchParams`, validasi task-id basi (toast "Task tidak ditemukan"), rename autofocus title (commit `26a35d2`)
- [x] Task 9: `ArchivedDialog.tsx` baru (list task terarsip, restore, delete permanen) + header board dikonsolidasi jadi satu menu `...` (Members/Export/Archived) (commit `280898a`)
- [x] Final: tambah assertion `positionBetween(null, null)` (kasus add-to-top di list kosong) ke `reorderUtils.selfcheck.ts` — 14/14 PASS (commit `7ee1900`)
  - [x] Typecheck + build (`npm run build` → `tsc -b && vite build`) — exit 0, hanya warning pre-existing chunk >500 kB
  - [x] Lint (`npm run lint` → `oxlint`) — bersih, tanpa output
  - [x] Self-check posisi (`npx tsx src/features/board/reorderUtils.selfcheck.ts`) — 14/14 PASS
  - [ ] Manual E2E walkthrough (dialog dua kolom, autosave blur, context-menu desktop vs dropdown mobile, archive/restore/delete, deep-link `?task=`) — **pending maintainer**: butuh browser + sesi login, belum dijalankan agen
  - [ ] Migrasi `archived_at` — **belum di-apply ke DB live**, pending maintainer via `pnpm migrate:up`
  - [ ] Merge `feat/fase5-task-actions` → `main` + deploy — pending keputusan maintainer

## Fase 6.1 — Assignee
Plan: docs/superpowers/plans/2026-09-08-fase6-assignee-task-actions.md
Spec: docs/superpowers/specs/2026-09-08-fase6-assignee-design.md
Status: **kode selesai di `main`, diimplementasi lewat subagent-driven development (implementer → spec reviewer → code-quality reviewer per task), semua APPROVED.** Migrasi sudah di-apply ke DB live. Belum di-deploy (belum di-push ke `origin/main`).

- [x] Task 0: Migrasi `task_assignees` (composite PK, index `user_id`, RLS) + regen `database.types.ts` (commit `c42af46`, fix keamanan RLS pakai helper `is_project_member()` di commit `1b299a1`)
- [x] Task 1: Komponen `Avatar` — inisial dengan warna hash deterministik, fallback foto profil (commit `4057351`)
- [x] Task 2: Hooks `useTaskAssignees` (batch read per project) + `useToggleAssignee` (mutation, non-optimistic) (commit `7efceea`)
- [x] Task 3: `TaskCard.tsx` — avatar stack (maks 3 + badge `+N`) di bawah judul task (commit `368619a`)
- [x] Task 4: `TaskDialog.tsx` — chip picker assignee di kolom kanan, toggle instan tanpa tombol Save (commit `9f91ccc`)
- [x] Task 5: QA akhir + dokumentasi
  - [x] Build (`npm run build` → `tsc -b && vite build`) — exit 0
  - [x] Lint (`npm run lint` → `oxlint`) — bersih, tanpa output
  - [ ] Manual E2E walkthrough (assign/unassign lewat chip, avatar stack update di card) — **pending maintainer**: butuh browser + sesi login
  - [x] PROGRESS/CHANGELOG/MEMORY diperbarui

## Deployment

| | |
|---|---|
| URL | https://kanban.cundus.my.id (HTTP 200) |
| Supabase project ref | `nbcgglhxqtgewtoeqbnf` |
| Served from | `/var/www/kanban/`, by the nginx already running on the VPS |
| **Auto deploy** | **VPS webhook** — push to `main` → the VPS pulls, builds, and rsyncs. ~8 s end to end |
| Manual deploy | `deploy.ps1` — gitignored, lives only on the maintainer's machine. Fallback |
| GitHub Actions | `.github/workflows/deploy.yml` — non-functional, see below |
| Fase 2 deploy | `main` `98121b0` (lalu `59b767a` fix mobile DnD) auto-deployed live via webhook pada 2026-09-06 (bundle `index-C9SpamEW.js`). DB migration `20260906010000_fractional_positions.sql` **sudah di-apply** live pada 2026-09-06 — kolom `lists.position` & `tasks.position` terverifikasi `double precision`. |
| Fase 3 deploy | `main` `41b196e` auto-deployed live via webhook pada 2026-09-07 (bundle `index-DVijB2h6.js`, HTTP 200). DB migration `20260906020000_project_members_rls.sql` **sudah di-apply** live pada 2026-09-07 — tabel `project_members` + 3 fungsi + backfill owner OK. |
| Fase 4 deploy | `main` `77dfa71` auto-deployed live via webhook pada 2026-09-07 (bundle `index-D5xNrsS_.js`, HTTP 200). Tanpa migrasi DB / dep baru. |

Hosting stays on the VPS. Cloudflare Pages and other external build hosts were considered and declined.

### Auto deploy via webhook

A small Python webhook server (stdlib only, ~13 MB RSS) already existed on the VPS to deploy another
project. It was extended to route by URL path so one process serves several repos, and moved to
`/opt/deploy-webhook/` — it previously lived inside the other project's git repo, where that repo's own
`git pull` would have overwritten it.

- Targets are declared in `/etc/deploy-webhook/targets.json`; each has its own secret, directory, branch
  and deploy command, and its own concurrency lock, so one project's slow deploy can't block another's.
- Secrets live in `/etc/deploy-webhook/deploy-webhook.env`, mode 0600. They used to sit in the systemd
  unit, which is world-readable at 644.
- Every request is HMAC-verified. A target whose secret is missing is dropped at load rather than
  running unauthenticated; if the config file is unusable the server falls back to the previous
  single-target behaviour instead of going dark.
- The endpoint is **`https://deployer.cundus.my.id`**, an nginx vhost with a Let's Encrypt certificate
  that proxies to the server. The server binds **`127.0.0.1` only** — nginx is the sole way in, so the
  `X-Forwarded-For` it sets can be trusted for logging the real caller.
- **No IP allowlist.** The port was previously exposed directly and firewalled to GitHub's published
  webhook ranges. That list is a snapshot: when GitHub adds a range, deliveries are dropped by the
  firewall with no error anywhere, and deploys stop silently. HMAC is the actual authentication and does
  not care about source IP, so behind nginx on 443 the allowlist was removed rather than maintained.
- The kanban deploy is: `git pull` → `pnpm install --frozen-lockfile` → `pnpm build` →
  `rsync -a --delete --chmod=D755,F644 dist/ /var/www/kanban/`. The `--chmod` replaces the old
  `find … -exec chmod` pair: scp/rsync would otherwise inherit a 700 umask that blocks nginx from reading.

The VPS now has Node 22 and pnpm 9 installed (~309 MB of `node_modules`) so it can build the site itself.

### GitHub Actions is blocked

Both workflow runs failed with zero steps executed: *"The job was not started because your account is
locked due to a billing issue."* This is an account-level lock, not exhausted minutes — a public repo gets
free unlimited Actions minutes, so repo visibility is irrelevant here, and self-hosted runners are blocked
by the same lock. The workflow YAML itself is fine and will work unchanged once billing clears. It is kept
for that reason, but the webhook above is now the real deploy path.

### VPS reality vs what the PRD assumed — measured 6 September 2026

The PRD describes a box "already running many other applications" and budgets accordingly. That was
anticipation, not measurement. Measured:

| PRD assumed | Measured |
|---|---|
| 2 core / 4 GB | 2× AMD EPYC 9754, 3.6 GiB |
| Already crowded | 772 MB used, **2.8 GB available**, load 0.40/core |
| (swap not mentioned) | 1.9 GB swap, **0 B used** |
| — | 59 GB disk, 42% used |

A full build on the VPS: `pnpm install` 8 s, `pnpm build` 6 s, peak Node RSS **508 MB**, and
`MemAvailable` never fell below **2,342 MB** with zero swap touched.

So building on the VPS is comfortable, contrary to the caution the PRD's assumption implies. Kanban's
steady-state footprint is still effectively zero — no process of its own, just static files on the nginx
that was already running, plus the shared webhook listener.

Also running on the box: another project's Next.js + FastAPI + Postgres stack in Docker, nginx, fail2ban.

## Live verification — 6 September 2026

Checked against the running Supabase project via its REST API with the anon key:

- Tables `profiles`, `lists`, `tasks`, `projects` all exist → migration `20260906000000_init_schema.sql` is applied.
- `project_members` returns `PGRST205` (absent) → matches Fase 1 scope; it lands in Fase 3.
- Google OAuth provider is enabled on the project.
- Unauthenticated reads of every table return `[]` rather than rows → RLS is on and denies anon.
- The deployed JS bundle embeds Supabase ref `nbcgglhxqtgewtoeqbnf` → production points at the same project as `.env.local`.

**What this does not prove:** that user A cannot read user B's projects. Only anon-vs-authenticated was
exercised; owner-vs-owner isolation needs two real Google accounts and is still open in Task 18.

## Open items

- Manual E2E walkthrough and two-account RLS check (Task 18).
- Email/password auth is also enabled on the Supabase project, but the PRD (§4.1) specifies Google as the
  only login method. Harmless today — RLS scopes every row to `owner_id`, so a stray signup sees an empty
  board — but worth disabling in the Supabase dashboard to match the spec.

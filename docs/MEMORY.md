# Memory — Cross-Session Context

## Key Decisions
- **Position kini `double precision` (fractional index, midpoint `POSITION_STEP=1024`)** sejak Fase 2, migrasi `supabase/migrations/20260906010000_fractional_positions.sql` (sudah di-apply ke DB live pada 2026-09-06). Helper di `src/features/board/reorderUtils.ts`: `positionAtEnd` / `positionBetween` / `positionForIndex` / `needsRebalance` / `rebalance`. `swapPosition()` lama masih diekspor untuk self-check tapi tak lagi dipakai runtime.
- **`project_members` + RLS berbasis keanggotaan sejak Fase 3**, migrasi `supabase/migrations/20260906020000_project_members_rls.sql` (**ditulis & di-review, belum di-apply ke DB live** per 2026-09-06 — pending `DATABASE_URL`/maintainer). Rekursi `projects ↔ project_members` dicegah fungsi `SECURITY DEFINER` milik `postgres`: `is_project_member(p_project)`, `is_project_owner(p_project)`, `shares_project_with(p_user)` — policy tabel lain tidak pernah query `project_members`/`projects` langsung. Trigger `on_project_created` (`handle_new_project()`) menambah baris owner `accepted` tiap project baru; ada backfill untuk project lama. Klaim undangan lewat RPC `claim_pending_invites()` (SECURITY DEFINER, cocokkan `invited_email` ↔ `auth.jwt()->>'email'`) dipanggil di `useAuth` pada `SIGNED_IN`. **Keputusan gating:** member boleh CRUD **list + task** (pelonggaran sadar dari PRD §4.2 "member = CRUD task" — board kolaboratif); owner-only tetap: hapus/rename project + invite/remove member + tidak ada policy UPDATE di `project_members`. Baris owner tak bisa dihapus manual (kedua policy DELETE mensyaratkan `role <> 'owner'`).
- **No formal test framework in Fase 1.** Manual verification only, except for non-trivial pure logic (`reorderUtils.ts`) which has an assert-based self-check runnable via `pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts`.
- **Route definitions live inline in `src/App.tsx`**, not a separate `src/routes/` folder — only 3 routes exist. Revisit if routing grows in Fase 3+.
- **Mutasi board (move task, reorder list) kini optimistic** (`onMutate` cancel+snapshot, `onError` restore + `toast.error`, `onSettled` invalidate) sejak Fase 2. CRUD lain (project/list/task create/update/delete) masih invalidate-on-success.
- **`sonner` ditambahkan di Fase 2** — satu `<Toaster richColors position="bottom-right" />` di `src/App.tsx`, dipakai di `onError` mutation board untuk menampilkan kegagalan drag + rollback.
- **`useTasks` kini project-scoped (`['tasks', projectId]`), bukan per-list** — jadi satu sumber kebenaran untuk `DndContext` di `BoardPage`. `useReorderTask` dihapus, diganti `useMoveTask` (menangani reorder dalam list dan pindah antar list dalam satu mutation).
- **Task 0 (Supabase project + Google OAuth) was a manual, user-performed step; it is now done.** Verified live on 6 Sep 2026: project ref `nbcgglhxqtgewtoeqbnf`, Google provider enabled, `.env.local` filled, and the init migration applied (all four Fase 1 tables present, `project_members` correctly absent). Most Fase 1 code was written and reviewed before this existed.
- **Email/password auth is also enabled on the Supabase project**, though the PRD (§4.1) calls for Google-only. Not exploitable today because RLS scopes everything to `owner_id`, but disable it in the dashboard when convenient.

## Deferred (deliberately, not forgotten)
- ~~Sanitasi HTML markdown (DOMPurify)~~ — **selesai Fase 3**. `dompurify` (^3.4.15) membungkus output `marked` lewat helper `src/features/board/markdown.ts` (`renderMarkdown`), dipakai `TaskDialog` view + `MarkdownEditor` preview. Tak ada lagi `marked.parse` langsung ke `dangerouslySetInnerHTML`.
- ~~Invite member, multi-user RLS (`project_members`)~~ — **kode selesai Fase 3** (branch `fase3-invite-member`); migrasi belum di-apply live, branch belum di-merge.
- ~~Import/export JSON — Fase 4~~ — **kode selesai** (branch `fase4-import-export`, belum merge/deploy). Fitur `src/features/import-export/`: Export dari header board (`useExportProject` + `buildExport` murni), Import dari daftar project (`ImportDialog` + `useImportProject`). Format `personal-kanban-export` v1 (nested lists→tasks, tanpa `id` apa pun). Validasi/normalisasi murni di `importValidation.ts` (+ `.selfcheck.ts`, 17 PASS). Import = project baru selalu; `owner_id`/`created_by` = user yang meng-import; `position` dihitung ulang dari urutan array (`POSITION_STEP`). Atomicity via rollback-by-delete (hapus project → cascade), **tanpa migrasi / RPC**. Batas: file ≤ 2 MB, ≤ 100 list, ≤ 2.000 task, deskripsi task ≤ 20.000 char, deskripsi project ≤ 2.000 char. Markdown import lewat `renderMarkdown` (DOMPurify) yang sama; nama dirender sebagai teks JSX.
- Due date reminders, labels, dark mode, attachments, activity log — Fase 5

## Conventions
- Feature-based folders: `src/features/{auth,projects,board,members,import-export}/` (`members/` sejak Fase 3, `import-export/` sejak Fase 4)
- One hook per Supabase table operation (query/create/update/delete/reorder), all via TanStack Query
- Pure logic yang non-trivial punya self-check assert-based (jalankan via `pnpm dlx tsx`): `src/features/board/reorderUtils.selfcheck.ts` (13 PASS) + `src/features/import-export/importValidation.selfcheck.ts` (17 PASS)
- Discriminated-union narrowing via `!x.ok` **tidak** menyempit di tsconfig ini (`strict` tidak aktif) — pakai `"errors" in res` untuk membedakan hasil `validateImport`
- shadcn/ui components live untouched in `src/components/ui/`; compose them in feature files
- Package manager: pnpm only (do not use npm/yarn lockfiles)

## Deployment
- **Fase 2 sudah live.** `main` kini di `98121b0`; di-merge dan auto-deployed live pada 2026-09-06 via webhook, bundle terpasang `index-BbItJkpg.js`. Migrasi `20260906010000_fractional_positions.sql` **sudah di-apply** ke Supabase live pada 2026-09-06 via `scripts/migrate.mjs` (session pooler ap-southeast-1). Masih open: walkthrough E2E manual & regresi RLS 2-akun (pending maintainer).
- **Fase 3 belum live.** Kode selesai di branch `fase3-invite-member` (`tsc -b`/`pnpm build`/self-check hijau). Migrasi `20260906020000_project_members_rls.sql` **belum di-apply** ke Supabase live. Branch belum di-merge ke `main`. Pending maintainer: apply migrasi via `scripts/migrate.mjs`, E2E 2 akun Google + regresi RLS akun ketiga, lalu merge + deploy.
- Live at **https://kanban.cundus.my.id**, static `dist/` served by the nginx already running on the VPS. Kanban runs no process of its own.
- **Auto deploy is a webhook on the VPS, not GitHub Actions.** Push to `main` → the VPS pulls, `pnpm install --frozen-lockfile`, `pnpm build`, then rsyncs into `/var/www/kanban/`. ~8 s end to end.
- The webhook server is shared with another project on the same box. It lives at `/opt/deploy-webhook/server.py`; targets in `/etc/deploy-webhook/targets.json`; secrets in `/etc/deploy-webhook/deploy-webhook.env` (0600). **It was moved out of the other project's git repo on purpose** — that repo's own `git pull` would overwrite it in place. Don't move it back.
- Adding another repo = one entry in `targets.json` + its secret in the env file. No new process.
- **Endpoint is `https://deployer.cundus.my.id` and the server binds `127.0.0.1` only**, behind an nginx vhost with a Let's Encrypt cert. Don't re-expose the port.
- **Deliberately no IP allowlist.** The port used to be open and firewalled to GitHub's published webhook CIDRs. That list is a snapshot — when GitHub adds a range, deliveries get dropped by the firewall silently and deploys just stop, with no error to notice. HMAC is the real authentication and is source-IP agnostic. Don't "harden" this by adding the allowlist back.
- **GitHub Actions is locked account-wide for billing** ("your account is locked due to a billing issue"). No repo-level change works around it — public repos get free minutes, and self-hosted runners are blocked by the same lock. `.github/workflows/deploy.yml` is correct as written and resumes working once billing clears; don't rewrite it chasing the failure.
- **`deploy.ps1` is the manual fallback and is gitignored — keep it that way.** `cundus/kanban` is a **public** repo, so the script (which holds the VPS host, user, and key path literally) stays out of git entirely rather than being parameterised with env vars. That was tried and reverted: hardcoding is fine precisely because the file never leaves the maintainer's machine. Don't commit it or abstract its values.
- **rsync/scp inherit a 700 umask on this box**, which makes nginx/www-data unable to read the files. The webhook handles it with `rsync --chmod=D755,F644`; `deploy.ps1` handles it with `find … -exec chmod`. Don't drop either.
- **Hosting stays on the VPS.** Cloudflare Pages / Netlify were proposed as a way to restore auto-deploy without GitHub Actions and were declined — self-hosting is the point. Don't re-propose them.
- Supabase URL + anon key are embedded at build time. Safe by design (PRD §7.2) — RLS, not key secrecy, enforces access. The VPS build reads them from `/home/ubuntu/kanban/.env.local` (0600, not in git).

## VPS capacity — measured, not assumed
- The PRD's "VPS sudah padat" is **anticipation, not measurement**. Measured 6 Sep 2026: 772 MB used of 3.6 GiB, **2.8 GB available**, load 0.40/core, 1.9 GB swap untouched, disk 42%.
- A full build on the VPS peaks at **508 MB** Node RSS and takes ~14 s including install; `MemAvailable` never dropped below 2.3 GB and swap stayed at 0.
- So "don't build on the VPS, it will OOM the neighbours" is **not** true for this box at this size. Re-measure before repeating that claim — it was asserted once from the PRD's assumption and was wrong.

## Related Docs
- PRD: docs/PRD-Personal-Kanban-App.md
- Fase 1 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase1-design.md
- Fase 1 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase1-mvp.md
- Fase 2 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase2-design.md
- Fase 2 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase2-dnd-markdown.md
- Fase 3 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase3-design.md
- Fase 3 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase3-invite-member.md
- Fase 4 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase4-design.md
- Fase 4 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase4-import-export.md

# Memory — Cross-Session Context

## Key Decisions
- **Position column is INTEGER in Fase 1**, not fractional index. Reorder = swap position value with neighbor via `swapPosition()` in `src/features/board/reorderUtils.ts`. Upgrade path to fractional index + drag-drop is Fase 2 — see spec §4.
- **No `project_members` table in Fase 1.** RLS checks `projects.owner_id = auth.uid()` directly. Multi-user support (invite member) is Fase 3 — will require a new migration adding `project_members` and rewriting RLS policies to check membership instead of ownership.
- **No formal test framework in Fase 1.** Manual verification only, except for non-trivial pure logic (`reorderUtils.ts`) which has an assert-based self-check runnable via `pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts`.
- **Route definitions live inline in `src/App.tsx`**, not a separate `src/routes/` folder — only 3 routes exist. Revisit if routing grows in Fase 3+.
- **Mutations use invalidate-on-success, not optimistic updates**, even though TanStack Query was chosen partly to enable optimistic updates later. Fase 1 doesn't need the complexity; add `onMutate`/`onError` rollback when drag-drop (Fase 2) needs instant visual feedback.
- **No toast library added.** Errors from mutations are not yet surfaced to the user beyond default TanStack Query error state (not wired to UI). Add error UI (or `sonner` toast) if this becomes a problem in QA.
- **Task 0 (Supabase project + Google OAuth) was a manual, user-performed step; it is now done.** Verified live on 6 Sep 2026: project ref `nbcgglhxqtgewtoeqbnf`, Google provider enabled, `.env.local` filled, and the init migration applied (all four Fase 1 tables present, `project_members` correctly absent). Most Fase 1 code was written and reviewed before this existed.
- **Email/password auth is also enabled on the Supabase project**, though the PRD (§4.1) calls for Google-only. Not exploitable today because RLS scopes everything to `owner_id`, but disable it in the dashboard when convenient.

## Deferred (deliberately, not forgotten)
- Drag & drop, fractional index — Fase 2
- Markdown live split-view editor — Fase 2
- Invite member, multi-user RLS (`project_members`) — Fase 3
- Import/export JSON — Fase 4
- Due date reminders, labels, dark mode, attachments, activity log — Fase 5

## Conventions
- Feature-based folders: `src/features/{auth,projects,board}/`
- One hook per Supabase table operation (query/create/update/delete/reorder), all via TanStack Query
- shadcn/ui components live untouched in `src/components/ui/`; compose them in feature files
- Package manager: pnpm only (do not use npm/yarn lockfiles)

## Deployment
- Live at **https://kanban.cundus.my.id**, static `dist/` served by the nginx already running on the VPS. Kanban runs no process of its own.
- **Auto deploy is a webhook on the VPS, not GitHub Actions.** Push to `main` → the VPS pulls, `pnpm install --frozen-lockfile`, `pnpm build`, then rsyncs into `/var/www/kanban/`. ~8 s end to end.
- The webhook server is shared with another project on the same box. It lives at `/opt/deploy-webhook/server.py`; targets in `/etc/deploy-webhook/targets.json`; secrets in `/etc/deploy-webhook/deploy-webhook.env` (0600). **It was moved out of the other project's git repo on purpose** — that repo's own `git pull` would overwrite it in place. Don't move it back.
- Adding another repo = one entry in `targets.json` + its secret in the env file. No new process.
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

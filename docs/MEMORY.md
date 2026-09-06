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
- Live at **https://kanban.cundus.my.id**, static `dist/` served by the existing reverse proxy — no Node process on the VPS, per the PRD's core constraint.
- **`deploy.ps1` is the only working deploy path right now.** GitHub Actions is locked account-wide for billing ("your account is locked due to a billing issue"), which no repo-level change can work around — public repos get free minutes, and self-hosted runners are blocked by the same lock. `.github/workflows/deploy.yml` is correct as written and resumes working once billing clears; don't rewrite it chasing the failure.
- **`deploy.ps1` is gitignored and must stay that way.** `cundus/kanban` is a **public** repo, so the script — which holds the VPS host, user, and key path literally — is kept out of git entirely rather than parameterised with env vars. That was tried and reverted: hardcoding is fine precisely because the file never leaves the maintainer's machine. Don't "helpfully" commit it or abstract its values.
- **Hosting stays on the VPS.** Cloudflare Pages / Netlify were proposed as a way to restore auto-deploy without GitHub Actions and were declined — self-hosting is the point. Don't re-propose them.
- **`deploy.ps1` chmods after scp on purpose.** scp creates directories with the remote umask, which was 700 here and made nginx/www-data unable to read them. Do not drop the `find ... -exec chmod` lines.
- Supabase URL + anon key are embedded at build time. That is safe by design (PRD §7.2) — RLS, not key secrecy, is what enforces access.

## Related Docs
- PRD: docs/PRD-Personal-Kanban-App.md
- Fase 1 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase1-design.md
- Fase 1 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase1-mvp.md

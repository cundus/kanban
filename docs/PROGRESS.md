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
  - [ ] Manual E2E walkthrough — **still open**, needs a human browser session (Google login → project → list → task → markdown)
  - [ ] RLS isolation check (two accounts) — **partially verified**, see below

## Deployment

| | |
|---|---|
| URL | https://kanban.cundus.my.id (HTTP 200) |
| Supabase project ref | `nbcgglhxqtgewtoeqbnf` |
| VPS path | `/var/www/kanban/` behind the existing reverse proxy |
| Auto deploy | `.github/workflows/deploy.yml` — **currently non-functional**, see below |
| Manual deploy | `deploy.ps1` — `pnpm build` + scp, then chmod 755/644 (scp inherits a 700 umask that blocks nginx). **This is the working deploy path.** |

`deploy.ps1` is **gitignored on purpose** and is not in the repository. `cundus/kanban` is a public repo, so
the VPS host, user, and key path are kept out of it entirely rather than being parameterised — the script
holds them literally, and lives only on the maintainer's machine alongside `.vps-access.local.md`.

Hosting stays on the VPS. Cloudflare Pages and other external build hosts were considered and declined.

### GitHub Actions is blocked

Both workflow runs failed with zero steps executed: *"The job was not started because your account is
locked due to a billing issue."* This is an account-level lock, not exhausted minutes — a public repo gets
free unlimited Actions minutes, so repo visibility is irrelevant here, and self-hosted runners are blocked
by the same lock. The workflow YAML itself is fine and will work unchanged once billing clears.

Deployment alternatives that sidestep GitHub Actions entirely, if the lock persists:
- **Cloudflare Pages / Netlify** — connect via their GitHub App (webhook, not Actions), build on their
  infrastructure, point `kanban.cundus.my.id` at it by CNAME. Drops VPS involvement to literally zero.
- Building on the VPS via `git pull` is **not** recommended: a Vite build spikes hundreds of MB of RAM on a
  2-core/4GB box that is already loaded, which is exactly what PRD §6 sets out to avoid.

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

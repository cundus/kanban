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
Status: **done (kode) — E2E manual & RLS 2-akun pending maintainer; migrasi live belum di-apply (nunggu DATABASE_URL)**

- [x] Task 0: Prasyarat (verifikasi baseline, branch kerja)
- [x] Task 1: Dependencies (@dnd-kit + sonner) + mount Toaster
- [ ] Task 2: Migrasi fractional position (double precision) + regen types
  - Step 1,3-5 selesai: file migrasi `20260906010000_fractional_positions.sql` ditulis, `database.types.ts` diperbarui manual (Supabase CLI tidak terpasang, `position` tetap `number`), `tsc -b` exit 0, commit `feat: migrate list/task position to fractional double precision`.
  - Step 2 (apply migrasi ke DB live) **pending** — menunggu `DATABASE_URL`; maintainer akan menerapkan via `scripts/migrate.mjs`. Checkbox tetap belum dicentang sampai migrasi diterapkan.
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

## Deployment

| | |
|---|---|
| URL | https://kanban.cundus.my.id (HTTP 200) |
| Supabase project ref | `nbcgglhxqtgewtoeqbnf` |
| Served from | `/var/www/kanban/`, by the nginx already running on the VPS |
| **Auto deploy** | **VPS webhook** — push to `main` → the VPS pulls, builds, and rsyncs. ~8 s end to end |
| Manual deploy | `deploy.ps1` — gitignored, lives only on the maintainer's machine. Fallback |
| GitHub Actions | `.github/workflows/deploy.yml` — non-functional, see below |

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

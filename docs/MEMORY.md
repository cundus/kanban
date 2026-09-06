# Memory — Cross-Session Context

## Key Decisions
- **Position column is INTEGER in Fase 1**, not fractional index. Reorder = swap position value with neighbor via `swapPosition()` in `src/features/board/reorderUtils.ts`. Upgrade path to fractional index + drag-drop is Fase 2 — see spec §4.
- **No `project_members` table in Fase 1.** RLS checks `projects.owner_id = auth.uid()` directly. Multi-user support (invite member) is Fase 3 — will require a new migration adding `project_members` and rewriting RLS policies to check membership instead of ownership.
- **No formal test framework in Fase 1.** Manual verification only, except for non-trivial pure logic (`reorderUtils.ts`) which has an assert-based self-check runnable via `pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts`.
- **Route definitions live inline in `src/App.tsx`**, not a separate `src/routes/` folder — only 3 routes exist. Revisit if routing grows in Fase 3+.
- **Mutations use invalidate-on-success, not optimistic updates**, even though TanStack Query was chosen partly to enable optimistic updates later. Fase 1 doesn't need the complexity; add `onMutate`/`onError` rollback when drag-drop (Fase 2) needs instant visual feedback.
- **No toast library added.** Errors from mutations are not yet surfaced to the user beyond default TanStack Query error state (not wired to UI). Add error UI (or `sonner` toast) if this becomes a problem in QA.
- **Task 0 (Supabase project + Google OAuth setup) is a manual, user-performed step** and was still pending as of Fase 1 code completion. `.env.local` (Task 4) and applying `supabase/migrations/*.sql` to the live dashboard (part of Task 8) are blocked on it. All other Fase 1 code was implemented and reviewed without it.

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

## Related Docs
- PRD: docs/PRD-Personal-Kanban-App.md
- Fase 1 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase1-design.md
- Fase 1 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase1-mvp.md

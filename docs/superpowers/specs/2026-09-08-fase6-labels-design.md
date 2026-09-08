# Fase 6.2 — Labels Design

**Status:** Approved
**Date:** 2026-09-08
**Depends on:** Fase 6.1 (Assignee) — reuses the `is_project_member()` RLS helper and the shared-cache independent-hook-call pattern established there.

## 1. Goal

Let project members tag tasks with colored labels (e.g. "Bug", "Urgent") for quick visual categorization on the board. Labels are per-project, unlimited per task, and manageable by any project member.

## 2. Data Model

### `labels` table

```sql
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);
```

- `color`: hex string (e.g. `#ef4444`), stored as-is from a native `<input type="color">`. No validation beyond NOT NULL — browser color input always emits a valid 7-char hex.
- No `updated_at` — label edits are rare and not tracked; matches `projects`/`lists` precedent (no audit trail on simple metadata tables).

### `task_labels` table (join table)

```sql
create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);
```

- Many-to-many, unlimited labels per task (no application-level cap).
- No `assigned_at` column — unlike `task_assignees`, ordering/audit of label attachment is not needed (labels are typically added once at task creation and rarely reordered).

### RLS Policies

Both tables use the existing `public.is_project_member(project_id)` SECURITY DEFINER helper (from `20260906020000_project_members_rls.sql`, fixed for `task_assignees` in Fase 6.1's `20260908011000_task_assignees_rls_fix.sql`). All project members get full CRUD — no owner-only gate, consistent with Fase 3's "member = full collaborator" decision.

```sql
alter table public.labels enable row level security;

create policy "members can view labels" on public.labels
  for select using (public.is_project_member(project_id));

create policy "members can manage labels" on public.labels
  for all using (public.is_project_member(project_id));

alter table public.task_labels enable row level security;

create policy "members can view task labels" on public.task_labels
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = task_labels.task_id
        and public.is_project_member(t.project_id)
    )
  );

create policy "members can manage task labels" on public.task_labels
  for all using (
    exists (
      select 1 from public.tasks t
      where t.id = task_labels.task_id
        and public.is_project_member(t.project_id)
    )
  );
```

### `database.types.ts`

Add `labels` and `task_labels` Row/Insert/Update blocks (hand-written, same pattern as `task_assignees`).

## 3. Hooks

New file `src/features/board/useLabels.ts`:

- `useLabels(projectId)` — query all label definitions for a project. Used by `LabelsDialog` (management) and the `TaskDialog` label chip picker (selection source).
- `useCreateLabel(projectId)` — mutation, inserts a row into `labels`, invalidates `useLabels` cache.
- `useUpdateLabel(projectId)` — mutation, updates `name`/`color` on an existing label, invalidates `useLabels` cache.
- `useDeleteLabel(projectId)` — mutation, deletes a label (cascade removes it from all `task_labels` rows via FK `on delete cascade`), invalidates `useLabels` cache.
- `useTaskLabels(projectId)` — batch fetch, EXACT same 2-query-then-merge pattern as `useTaskAssignees`: fetch task ids in project → fetch `task_labels` rows for those tasks → fetch `labels` rows for the unique label_ids referenced → merge into `Record<task_id, Label[]>`. Called independently by both `TaskCard` and `TaskDialog` (same queryKey `["task-labels", projectId]` dedupes via TanStack Query, no prop drilling).
- `useToggleTaskLabel(taskId, projectId)` — mutation, insert/delete a row in `task_labels` based on current membership, non-optimistic (matches `useToggleAssignee`), invalidates `useTaskLabels` cache, Indonesian error toast "Gagal mengubah label." on failure.

## 4. UI Components

### `LabelBadge` (new, `src/components/ui/label-badge.tsx`)

Small pill: `<span style={{ backgroundColor: color }}>{name}</span>` with fixed text color logic (light/dark contrast — reuse simple luminance check, no new dependency) so text stays readable against any user-picked background color. Used in `TaskCard` (read-only display) and `TaskDialog` (interactive chip).

### `LabelsDialog` (new, `src/features/board/LabelsDialog.tsx`)

Mirrors `MembersDialog`/`ArchivedDialog` structure — `Dialog`+`DialogContent`+`DialogHeader`. Opened from the board header's "..." menu (same menu that already opens Members/Archived dialogs). Lists existing labels via `useLabels(projectId)`; each row shows `LabelBadge` + edit (name text `Input` + native `<input type="color">`) + delete `Button`. A "create new label" row at the bottom with the same two inputs + create `Button`.

### `TaskCard.tsx` (modify)

New row of `LabelBadge` pills rendered above the assignee avatar stack (labels = category, shown first; assignees = people, shown second), calls `useTaskLabels(projectId)` independently.

### `TaskDialog.tsx` (modify)

New "Label" section in the right column, positioned directly after the existing "Assignee" chip picker section. Same instant-toggle multi-select chip UI pattern established in Fase 6.1 (click chip = immediate `useToggleTaskLabel` mutation, no Save button). Chips sourced from `useLabels(projectId)` (all project labels), rendered via `LabelBadge` with an active/inactive visual state based on `useTaskLabels` membership. A "Manage labels" link/button opens `LabelsDialog` for create/edit/delete when the user needs a label that doesn't exist yet.

## 5. Out of Scope (explicit, deferred)

- Filter board by label — future fase, same precedent as Fase 6.1's deferred filter-by-assignee.
- Per-task label count limit — unlimited by design, no cap enforced.
- Label reordering / drag-to-reorder in `LabelsDialog` — labels display in creation order (or alphabetical — decided at implementation time, non-functional detail).

## 6. Testing

No test framework in this repo (consistent with Fase 1-6.1). Build (`tsc -b && vite build`) + lint (`oxlint`) are the QA gate for all new I/O hooks and components. No pure-logic file introduced here that would warrant a `*.selfcheck.ts` (label color contrast helper is trivial enough to verify by eye in build/lint pass, same threshold used for `hashColor`/`getInitials` in Fase 6.1's `Avatar` component). Manual E2E smoke check (create/edit/delete label, toggle on task, see pill on card) flagged as pending-maintainer, same as every prior fase.

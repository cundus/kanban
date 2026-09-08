# Fase 6.1 — Assignee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Executor model:** This plan is written for mid-level execution (Sonnet 4.6 / Kimi 2.7 Code). Every step has pseudocode — translate to real code, do not make architecture decisions.

**Goal:** Add multi-assignee support to tasks: a new `task_assignees` join table, hooks to read/toggle assignees, an avatar stack on `TaskCard`, and a chip picker in `TaskDialog`.

**Architecture:** New Supabase table + RLS policies mirroring the existing `project_members` pattern. One new React Query hook pair (`useTaskAssignees` batch-read per project, `useToggleAssignee` per-task mutation) following the exact 2-query-then-merge pattern already used by `useMembers`. Both `TaskCard` and `TaskDialog` call `useTaskAssignees(projectId)` independently — same React Query key means TanStack Query dedupes the network call, so no prop-drilling needed (this mirrors how `TaskDialog` already calls `useMembers(projectId)` on its own instead of receiving it as a prop from `BoardPage`).

**Tech Stack:** No new dependencies. Supabase-js 2.115.0 + TanStack Query 5.102.8, same as every other Fase 5 hook.

**Project Conventions:**
- Component library: custom `src/components/ui/*.tsx` on `@base-ui/react` + CVA (no shadcn CLI in this repo)
- Styling: Tailwind v4 semantic tokens (`text-text-1`, `bg-surface-2`, `border-line`, etc.) — see exception noted in Task 1 for avatar color hashing
- Icons: `lucide-react`
- Data hooks: TanStack Query, mutation pattern = `useMutation` + `onSuccess: () => queryClient.invalidateQueries(...)`, NOT optimistic unless explicitly noted (see `useArchiveTask` as the one exception in this codebase)
- Bare import aliases: `cn` (className merge util), `@/` → `src/`
- Language: code/comments in English, UI copy in Bahasa Indonesia (see `TaskDialog.tsx`'s "Dibuat oleh"/"Terakhir diubah" labels)

---

## Reuse Map

**Existing components available (DO NOT recreate):**
- `Button` (variants: default, outline, secondary, ghost, destructive, link; sizes: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg) — `@/components/ui/button`
- `Input` — `@/components/ui/input`
- `Label` — `@/components/ui/label`
- `Dialog`, `DialogContent` (accepts `size: "default" | "lg"` prop), `DialogHeader` — `@/components/ui/dialog`
- `Tooltip` — `@/components/ui/tooltip`

**Existing utilities:**
- `cn()` — bare import `from "cn"`
- `supabase` — `@/lib/supabase` (typed Supabase client, `createClient<Database>(...)`)
- `formatRelativeTime()` — `@/lib/formatRelativeTime`

**Existing hooks:**
- `useMembers(projectId)` — `@/features/members/useMembers`, returns `{ data: MemberRow[] | undefined, isLoading }`. `MemberRow extends project_members Row` with `profile: { full_name, avatar_url, email } | null`.
- `useUpdateTask(projectId)`, `useTasks(projectId)`, `tasksKey(projectId)` — `./useTasks` (same folder as new files, relative import `./useTasks`)

**Existing types:**
- `Database` — `@/types/database.types` (hand-written, manually maintained — see Task 0)
- `Task = Database["public"]["Tables"]["tasks"]["Row"]`

**DO NOT recreate any of the above. Import and use them.**

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260908010000_task_assignees.sql` | Create | New `task_assignees` table + index + RLS policies |
| `src/types/database.types.ts` | Modify | Add `task_assignees` table type block |
| `src/components/ui/avatar.tsx` | Create | Shared avatar component (img + hashed-color initials fallback) |
| `src/features/board/useTaskAssignees.ts` | Create | `useTaskAssignees` (batch read) + `useToggleAssignee` (mutation) |
| `src/features/board/TaskCard.tsx` | Modify | Render avatar stack below task title |
| `src/features/board/TaskDialog.tsx` | Modify | Add "Assignee" chip-picker section in right column |

---

### Task 0: Migration + Types

**Goal:** Create the `task_assignees` table with RLS, apply it to the live DB, and update the hand-written TS types.

**Files:**
- Create: `supabase/migrations/20260908010000_task_assignees.sql`
- Modify: `src/types/database.types.ts`

**Reuse check:**
- ✅ Migration runner already exists (`npm run migrate:up` / `npm run migrate:status`, `.env` has `DATABASE_URL` resolved) — do not create a new migration mechanism.

- [ ] **Step 1: Write the migration file**

Exact content for `supabase/migrations/20260908010000_task_assignees.sql`:

```sql
create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_assignees_user_idx on public.task_assignees(user_id);

alter table public.task_assignees enable row level security;

create policy "members can view task assignees" on public.task_assignees
  for select using (
    exists (
      select 1 from public.tasks t
      join public.project_members pm on pm.project_id = t.project_id
      where t.id = task_assignees.task_id and pm.user_id = auth.uid()
    )
  );

create policy "members can manage task assignees" on public.task_assignees
  for all using (
    exists (
      select 1 from public.tasks t
      join public.project_members pm on pm.project_id = t.project_id
      where t.id = task_assignees.task_id and pm.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration to live DB**

Run: `npm run migrate:up`
Then verify: `npm run migrate:status` — expect `20260908010000_task_assignees.sql` shows `[applied]`.

- [ ] **Step 3: Update `src/types/database.types.ts`**

Find the closing of the `tasks: { ... Relationships: [] }` block (currently ends at line 150 with `      }` before the final `    }` `  }` `}` that close `Tables`/`public`/`Database`). Insert a new `task_assignees` sibling entry immediately after the `tasks` block, before the closing `    }` of `Tables`:

```ts
      task_assignees: {
        Row: {
          task_id: string
          user_id: string
          assigned_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          assigned_at?: string
        }
        Update: {
          task_id?: string
          user_id?: string
          assigned_at?: string
        }
        Relationships: []
      }
```

Also update the file's top `ponytail:` comment (line 1) to append a note: `As of migration 20260908010000_task_assignees (Fase 6.1): adds the task_assignees join table.`

- [ ] **Step 4: Verify**

Run: `npm run build` (runs `tsc -b && vite build`) — expect exit 0, no type errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260908010000_task_assignees.sql src/types/database.types.ts
git commit -m "feat(db): add task_assignees table + RLS for Fase 6.1"
```

---

### Task 1: Avatar Component

**Goal:** Create a shared `Avatar` component (image or hashed-color initials fallback) for use in `TaskCard` and `TaskDialog`.

**Files:**
- Create: `src/components/ui/avatar.tsx`

**Imports needed:**
```
FROM "cn" IMPORT { cn }
```

**Reuse check:**
- ❌ No existing `Avatar` component in `src/components/ui/` (confirmed: only button, card, confirm-dialog, context-menu, dialog, empty-state, input, label, menu, skeleton, textarea, tooltip exist). `MembersDialog.tsx` has an inline raw `<img>`+fallback pattern (not extracted) — this task creates the reusable version, but does NOT modify `MembersDialog.tsx` (out of scope, keeps diff small per spec §5.1).

- [ ] **Step 1: Implement the component**

Pseudocode:
```
// ponytail: fixed 6-color palette for deterministic per-user hashing. This uses raw
// Tailwind color utilities (not semantic tokens) because the design system has no
// multi-hue "identity color" token set — semantic tokens (accent/danger/etc) are
// reserved for UI state, not decorative per-user differentiation. Upgrade path: if
// a design token set for avatar colors is added later, swap this array for tokens.
CONST AVATAR_PALETTE: string[] = [
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400",
]

CONST SIZE_CLASSES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-micro",
}

FUNCTION hashColor(name: string): string
  hash = 0
  FOR each char in name:
    hash = char.charCodeAt(0) + ((hash << 5) - hash)
  RETURN AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]

FUNCTION getInitials(name: string): string
  trimmed = name.trim()
  IF trimmed is empty: RETURN "?"
  parts = trimmed.split(/\s+/)
  IF parts.length === 1: RETURN parts[0].slice(0, 2).toUpperCase()
  RETURN (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()

EXPORT INTERFACE AvatarProps:
  name: string
  src?: string | null
  size?: "sm" | "md"  // default "md"
  className?: string

EXPORT COMPONENT Avatar({ name, src, size = "md", className }: AvatarProps):
  RETURN:
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        SIZE_CLASSES[size],
        !src && hashColor(name),
        className
      )}
    >
      IF src:
        <img src={src} alt="" className="size-full object-cover" />
      ELSE:
        {getInitials(name)}
    </span>
```

- [ ] **Step 2: Verify**

Run: `npm run build` && `npm run lint` — expect both exit 0 / clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/avatar.tsx
git commit -m "feat(ui): add Avatar component with hashed-color initials fallback"
```

---

### Task 2: `useTaskAssignees` + `useToggleAssignee` Hooks

**Goal:** Batch-read all task→assignee mappings for a project, and a mutation to toggle one user on one task.

**Files:**
- Create: `src/features/board/useTaskAssignees.ts`

**Imports needed:**
```
FROM "@tanstack/react-query" IMPORT { useMutation, useQuery, useQueryClient }
FROM "sonner" IMPORT { toast }
FROM "@/lib/supabase" IMPORT { supabase }
```

**Reuse check:**
- ✅ Follows the exact 2-query-then-merge pattern in `src/features/members/useMembers.ts` (no PostgREST FK embed available, same as that file's documented reason).
- ❌ No existing hook does this — new file.

- [ ] **Step 1: Implement**

Pseudocode:
```
EXPORT INTERFACE AssigneeProfile:
  user_id: string
  full_name: string | null
  avatar_url: string | null
  email: string

EXPORT FUNCTION taskAssigneesKey(projectId: string):
  RETURN ["task-assignees", projectId] as const

// Batch fetch: all assignees for all tasks in one project, one query pair.
// Called independently by both TaskCard and TaskDialog — same queryKey means
// TanStack Query dedupes to a single network round trip (same pattern as
// useMembers being called independently by MembersDialog AND TaskDialog).
EXPORT FUNCTION useTaskAssignees(projectId: string):
  RETURN useQuery({
    queryKey: taskAssigneesKey(projectId),
    queryFn: ASYNC (): Promise<Record<string, AssigneeProfile[]>> =>
      // 1. get all task ids in this project (RLS already scopes to project members)
      { data: tasks, error: tasksError } = AWAIT supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId)
      IF tasksError: THROW tasksError
      taskIds = (tasks ?? []).map(t => t.id)
      IF taskIds.length === 0: RETURN {}

      // 2. get all task_assignees rows for those tasks
      { data: rows, error } = AWAIT supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", taskIds)
      IF error: THROW error

      // 3. get profiles for all unique user_ids
      userIds = [...new Set((rows ?? []).map(r => r.user_id))]
      profilesById = new Map<string, Omit<AssigneeProfile, "user_id">>()
      IF userIds.length > 0:
        { data: profiles, error: profilesError } = AWAIT supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .in("id", userIds)
        IF profilesError: THROW profilesError
        FOR each p in (profiles ?? []):
          profilesById.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url, email: p.email })

      // 4. merge into Record<task_id, AssigneeProfile[]>
      result: Record<string, AssigneeProfile[]> = {}
      FOR each row in (rows ?? []):
        profile = profilesById.get(row.user_id)
        IF NOT profile: CONTINUE  // profile row missing/deleted, skip silently
        list = result[row.task_id] ?? []
        list.push({ user_id: row.user_id, ...profile })
        result[row.task_id] = list
      RETURN result
  })

// Toggle one user's assignment on one task. Not optimistic (ponytail: upgrade
// later if perceived latency is a problem — matches Fase 5's default of
// non-optimistic mutations except useArchiveTask).
EXPORT FUNCTION useToggleAssignee(taskId: string, projectId: string):
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: ASYNC ({ userId, isCurrentlyAssigned }: { userId: string; isCurrentlyAssigned: boolean }) =>
      IF isCurrentlyAssigned:
        { error } = AWAIT supabase
          .from("task_assignees")
          .delete()
          .eq("task_id", taskId)
          .eq("user_id", userId)
        IF error: THROW error
      ELSE:
        { error } = AWAIT supabase
          .from("task_assignees")
          .insert({ task_id: taskId, user_id: userId })
        IF error: THROW error
    ,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: taskAssigneesKey(projectId) })
    ,
    onError: () =>
      toast.error("Gagal mengubah assignee.")
  })
```

- [ ] **Step 2: Verify**

Run: `npm run build` && `npm run lint` — expect both exit 0 / clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/board/useTaskAssignees.ts
git commit -m "feat(board): add useTaskAssignees + useToggleAssignee hooks"
```

---

### Task 3: TaskCard Avatar Stack

**Goal:** Render up to 3 overlapping avatars (+N badge beyond that) below the task title on `TaskCard`.

**Files:**
- Modify: `src/features/board/TaskCard.tsx`

**Imports needed (add to existing file):**
```
FROM "@/components/ui/avatar" IMPORT { Avatar }
FROM "./useTaskAssignees" IMPORT { useTaskAssignees }
```

**Reuse check:**
- ✅ `Avatar` — created in Task 1, use it.
- ✅ `useTaskAssignees` — created in Task 2, use it.
- `TaskCard` already receives `projectId` as a prop — no new prop needed to call the hook.

- [ ] **Step 1: Implement**

Pseudocode (modify existing `TaskCard` function body):
```
IMPORT { Avatar } FROM "@/components/ui/avatar"
IMPORT { useTaskAssignees } FROM "./useTaskAssignees"

FUNCTION TaskCard({ task, listId, projectId, onOpen, onRenameTask, overlay = false }):
  { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable(...)  // unchanged, existing code

  // NEW: fetch once per project, shared cache with TaskDialog via same queryKey
  { data: assigneesByTask } = useTaskAssignees(projectId)
  assignees = assigneesByTask?.[task.id] ?? []

  style = { ... }  // unchanged, existing code

  IF overlay:
    RETURN (
      <article className="elev-lifted rounded-lg border border-accent-line bg-surface-2 px-3 py-2.5 text-ui text-text-1 rotate-2 scale-[1.03] cursor-grabbing">
        {task.title}
        IF assignees.length > 0:
          <AvatarStack assignees={assignees} />
      </article>
    )

  RETURN (
    <TaskActionsMenu task={task} projectId={projectId} variant="context" onRename={onRenameTask}>
      <article ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onOpen} className={cn(...)}>
        {task.title}
        IF assignees.length > 0:
          <AvatarStack assignees={assignees} />
        <div className="absolute right-1 top-1 ..." onClick={(e) => e.stopPropagation()}>
          <TaskActionsMenu task={task} projectId={projectId} variant="dropdown" onRename={onRenameTask} />
        </div>
      </article>
    </TaskActionsMenu>
  )

// New small helper component, defined in the same file below TaskCard.
FUNCTION AvatarStack({ assignees }: { assignees: AssigneeProfile[] }):
  shown = assignees.slice(0, 3)
  extra = assignees.length - shown.length
  RETURN (
    <div className="mt-1.5 flex -space-x-2">
      FOR each a in shown:
        <Avatar key={a.user_id} name={a.full_name ?? a.email} src={a.avatar_url} size="sm" className="ring-2 ring-surface-2" />
      IF extra > 0:
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-3 ring-2 ring-surface-2">
          +{extra}
        </span>
    </div>
  )
```

Note: `AssigneeProfile` type comes from `./useTaskAssignees` — add `import type { AssigneeProfile } from "./useTaskAssignees"`.

- [ ] **Step 2: Verify**

Run: `npm run build` && `npm run lint` — expect both exit 0 / clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/board/TaskCard.tsx
git commit -m "feat(board): show assignee avatar stack on TaskCard"
```

---

### Task 4: TaskDialog Chip Picker

**Goal:** Add an "Assignee" section to `TaskDialog`'s right column — toggleable chips for every project member, click = instant commit.

**Files:**
- Modify: `src/features/board/TaskDialog.tsx`

**Imports needed (add to existing file):**
```
FROM "@/components/ui/avatar" IMPORT { Avatar }
FROM "cn" IMPORT { cn }
FROM "./useTaskAssignees" IMPORT { useTaskAssignees, useToggleAssignee }
```

**Reuse check:**
- ✅ `useMembers(projectId)` — already imported and called in this file (line 15, 40) for creator lookup. Reuse the same `members` variable for the chip list — do not fetch members twice.
- ✅ `Avatar` — created in Task 1.
- ✅ `useTaskAssignees` / `useToggleAssignee` — created in Task 2.
- ✅ `Label` — already imported, reuse for the "Assignee" section heading (same bare `<Label>Description</Label>` pattern already used for the description field, no `htmlFor` needed since chips aren't a single form control).

- [ ] **Step 1: Implement**

Pseudocode (modify existing `TaskDialog` function body — insert after the `creator`/`creatorName`/`updatedRelative` lines, before the `return (`):
```
IMPORT { Avatar } FROM "@/components/ui/avatar"
IMPORT { cn } FROM "cn"
IMPORT { useTaskAssignees, useToggleAssignee } FROM "./useTaskAssignees"

// inside TaskDialog(), after existing `const { data: members } = useMembers(projectId)`:
{ data: assigneesByTask } = useTaskAssignees(projectId)
toggleAssignee = useToggleAssignee(currentTask.id, projectId)  // NOTE: must be called AFTER the `if (!task) return null` early-return check fails — see placement note below
currentAssigneeIds = new Set((assigneesByTask?.[currentTask.id] ?? []).map(a => a.user_id))

FUNCTION handleToggleAssignee(userId: string):
  isCurrentlyAssigned = currentAssigneeIds.has(userId)
  toggleAssignee.mutate({ userId, isCurrentlyAssigned })
```

**Placement note:** `useTaskAssignees` and `useToggleAssignee` are hooks and MUST be called unconditionally before the `if (!task) return null` line (React rules of hooks — the file already calls `useUpdateTask`/`useMembers` before that check, follow the same ordering). `useToggleAssignee(currentTask.id, ...)` needs `currentTask.id`, but hooks can't be called after the early return. Fix: call `useToggleAssignee(task?.id ?? "", projectId)` at the top alongside the other hooks (using optional chaining with an empty-string fallback for the not-yet-loaded case — the mutation is never invoked before the dialog is open with a real task, so the fallback id is inert), THEN do the `if (!task) return null` check, THEN compute `currentAssigneeIds` after `currentTask` is defined.

Revised exact placement (top of function, alongside existing hook calls):
```
CONST updateTask = useUpdateTask(projectId)                     // existing
CONST { data: members } = useMembers(projectId)                  // existing
CONST { data: assigneesByTask } = useTaskAssignees(projectId)     // NEW
CONST toggleAssignee = useToggleAssignee(task?.id ?? "", projectId)  // NEW
```

Then after `const currentTask = task` (existing line, after the early return):
```
CONST currentAssigneeIds = new Set(
  (assigneesByTask?.[currentTask.id] ?? []).map(a => a.user_id)
)

FUNCTION handleToggleAssignee(userId: string):
  isCurrentlyAssigned = currentAssigneeIds.has(userId)
  toggleAssignee.mutate({ userId, isCurrentlyAssigned })
```

Then in the JSX, inside the right column `<div className="flex flex-col gap-4 md:order-2">`, insert a new block BETWEEN the due-date `<div>` and the creator/updated-at metadata `<div>`:
```jsx
<div className="flex flex-col gap-2">
  <Label>Assignee</Label>
  <div className="flex flex-wrap gap-1.5">
    {(members ?? []).map((m) => {
      IF NOT m.user_id: RETURN null  // pending invites have no user_id yet, can't be assigned
      isAssigned = currentAssigneeIds.has(m.user_id)
      name = m.profile?.full_name ?? m.profile?.email ?? m.invited_email
      RETURN (
        <button
          key={m.id}
          type="button"
          onClick={() => handleToggleAssignee(m.user_id!)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-micro transition-colors [transition-duration:var(--dur-fast)]",
            isAssigned
              ? "border-accent-line bg-accent-soft text-accent-solid"
              : "border-line text-text-3 hover:border-line-strong hover:text-text-2"
          )}
        >
          <Avatar name={name} src={m.profile?.avatar_url} size="sm" />
          {name}
        </button>
      )
    })}
  </div>
</div>
```

- [ ] **Step 2: Verify**

Run: `npm run build` && `npm run lint` — expect both exit 0 / clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/board/TaskDialog.tsx
git commit -m "feat(board): add assignee chip picker to TaskDialog"
```

---

### Task 5 (Final): QA + Docs

**Goal:** Full verification pass + update `docs/PROGRESS.md`/`CHANGELOG.md`/`docs/MEMORY.md`, matching the Fase 5 pattern exactly.

**Files:**
- Modify: `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md`

- [ ] **Step 1: Full build + lint**

Run: `npm run build` — expect exit 0.
Run: `npm run lint` — expect clean.

- [ ] **Step 2: Manual smoke check reminder**

No test framework in this repo. There is no new pure-logic file requiring a `*.selfcheck.ts` (unlike `reorderUtils.ts`) — assignee toggle is an I/O mutation, verified via build/lint + code review only, consistent with spec §6.

Flag as pending maintainer (same as every prior fase): manual E2E check that clicking a chip in `TaskDialog` actually assigns/unassigns and the avatar appears on the corresponding `TaskCard` — requires a live browser session against the deployed/dev app.

- [ ] **Step 3: Update docs**

`docs/PROGRESS.md` — add a new `## Fase 6.1 — Assignee` section (before whatever section currently follows Fase 5, e.g. before `## Deployment`) listing:
- Plan path: `docs/superpowers/plans/2026-09-08-fase6-assignee-task-actions.md`
- Spec path: `docs/superpowers/specs/2026-09-08-fase6-assignee-design.md`
- Status line + all 5 tasks as `[x]` checkboxes with their commit hashes (fill in actual hashes once committed)
- QA checklist: build ✅, lint ✅, E2E `[ ]` pending maintainer

`CHANGELOG.md` — add `## [Fase 6.1] - 2026-09-08` section (before the Fase 5 section) with `### Added` (task_assignees table, assignee avatar stack on TaskCard, assignee chip picker on TaskDialog, new Avatar component), `### Notes` (no new deps, non-optimistic mutation), `### Status` (code complete, pending E2E).

`docs/MEMORY.md` — update the Deferred section: move "Assignee" from the Fase 6 list to a completed/struck-through entry (same style as the Fase 5 correction that struck through "Task actions"). Add 1-2 new Key Decisions bullets: (a) `task_assignees` composite-PK join table + RLS pattern, (b) `useTaskAssignees`/`useToggleAssignee` shared-cache pattern (both TaskCard and TaskDialog call the hook independently, same queryKey dedupes).

- [ ] **Step 4: Commit docs**

```bash
git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
git commit -m "docs: update PROGRESS/CHANGELOG/MEMORY for Fase 6.1"
```

- [ ] **Step 5: Verify no scope creep**

Run: `git status --porcelain` — expect ONLY the 2 pre-existing unrelated dirty files (`M index.html`, `?? public/`) remain untouched, nothing else.

---

## Self-Review Notes

- **Spec coverage:** All 9 numbered decisions in the spec's §7 map to a task: (1) multi-assignee → Task 0 schema; (2) join table schema → Task 0; (3) no notification → nothing to build, correctly omitted; (4) filter deferred → correctly out of scope, no task; (5) avatar shows now → Task 3; (6) chip picker UI → Task 4; (7) Avatar component → Task 1; (8) hooks → Task 2; (9) migration file → Task 0.
- **Reuse violations checked:** No task recreates `Button`/`Input`/`Label`/`Dialog`/`useMembers` — all reused as-is.
- **Type consistency:** `AssigneeProfile` (Task 2) is the single source of truth for the shape used in both Task 3 (`TaskCard`) and Task 4 (`TaskDialog`) — both import it from `./useTaskAssignees`, no duplicate/divergent type defined.
- **Hooks-rule fix applied:** Task 4 explicitly calls out the rules-of-hooks issue (early `return null` before `currentTask.id` exists) and resolves it with `task?.id ?? ""` at the top-level hook call — this avoids a conditional hook call bug an executor might otherwise introduce.

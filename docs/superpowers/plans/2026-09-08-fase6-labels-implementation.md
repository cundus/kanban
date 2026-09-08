# Fase 6.2 — Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Executor model:** This plan is written for mid-level execution (Sonnet 4.6 / Kimi 2.7 Code). Every step has pseudocode — translate to real code, do not make architecture decisions.

**Goal:** Let project members tag tasks with colored labels for quick visual categorization. Labels are per-project, unlimited per task, manageable by any project member.

**Architecture:** New `labels` table (per-project label definitions) + `task_labels` join table (many-to-many, no cap). RLS via the existing `is_project_member(project_id)` helper. New `useLabels.ts` hooks file mirrors `useTaskAssignees.ts`'s batch-fetch-then-merge pattern. New `LabelBadge` UI atom + `LabelsDialog` management dialog (mirrors `MembersDialog`/`ArchivedDialog`). `TaskCard`/`TaskDialog` get independent `useTaskLabels(projectId)` calls — same shared-cache pattern established in Fase 6.1, no prop drilling.

**Tech Stack:** Vite + React 18.3.1 + TanStack Query 5 + Supabase-js + sonner + lucide-react + Tailwind v4, custom `src/components/ui/*` on `@base-ui/react` + CVA.

**Project Conventions:**
- Component library: `src/components/ui/*` (custom, not shadcn CLI). Import via `@/components/ui/<name>`.
- Styling: Tailwind utility classes, semantic tokens (`text-text-1`, `border-line`, `bg-surface-2`, etc.) — never raw hex/rgb in JSX className.
- Icons: `lucide-react`, size prop explicit (`size={14}`/`size={16}`), `strokeWidth={1.5}` on most icons.
- Data hooks pattern: one file per feature area under `src/features/<area>/use<Thing>.ts`, exported `useX(projectId)` queries + `useMutateX(...)` mutations, TanStack Query with explicit query keys, `onError` toasts via `sonner` in Indonesian.
- Bare import alias: `cn` from `@/lib/utils` (or wherever it's defined — check existing imports, don't guess path).
- Language convention: UI-facing strings in Indonesian where the codebase already does so (e.g. "Gagal mengubah assignee."); code/comments in English.
- Never `as any` / `@ts-ignore`. Never `git add -A`.

## Reuse Map

**Existing components available (DO NOT recreate):**
- `Button` from `@/components/ui/button`
- `Input` from `@/components/ui/input`
- `Label` from `@/components/ui/label`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog`
- `ConfirmDialog` from `@/components/ui/confirm-dialog`
- `Skeleton` from `@/components/ui/skeleton`
- `EmptyState` from `@/components/ui/empty-state`
- `Menu`, `MenuContent`, `MenuItem`, `MenuSeparator`, `MenuTrigger` from `@/components/ui/menu`

**Existing utilities:**
- `cn` — className merge helper
- supabase client (check existing import path used in `useTaskAssignees.ts`, reuse exact same import)

**Existing hooks:**
- `useTaskAssignees(projectId)` in `src/features/board/useTaskAssignees.ts` — the EXACT pattern to mirror for `useTaskLabels`/`useToggleTaskLabel`. Returns `Record<task_id, AssigneeProfile[]>`.

**Existing types:**
- `Database` from `@/types/database.types`

**DO NOT recreate any of the above. Import and use them.**

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260908020000_labels.sql` | Create | `labels` + `task_labels` tables, RLS via `is_project_member()` |
| `src/types/database.types.ts` | Modify | Add `labels`/`task_labels` Row/Insert/Update blocks |
| `src/components/ui/label-badge.tsx` | Create | `LabelBadge` pill component with luminance-contrast text |
| `src/features/board/useLabels.ts` | Create | `useLabels`, `useCreateLabel`, `useUpdateLabel`, `useDeleteLabel`, `useTaskLabels`, `useToggleTaskLabel` |
| `src/features/board/LabelsDialog.tsx` | Create | Label management dialog (create/edit/delete) |
| `src/features/board/BoardPage.tsx` | Modify | Wire "Labels" menu item + mount `LabelsDialog` |
| `src/features/board/TaskCard.tsx` | Modify | Show label pill row above assignee avatar stack |
| `src/features/board/TaskDialog.tsx` | Modify | Add "Label" chip section + "Manage labels" button |
| `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md` | Modify | Document Fase 6.2 completion |

---

### Task 0: Migration + Types

**Goal:** Create `labels` + `task_labels` tables with correct RLS from the start (using `is_project_member()` directly — no raw-join bug like Fase 6.1's original mistake).

**Files:**
- Create: `supabase/migrations/20260908020000_labels.sql`
- Modify: `src/types/database.types.ts`

**Imports needed:** none (SQL + hand-written types)

**Reuse check:**
- ✅ Reuses `public.is_project_member(project_id)` helper from `20260906020000_project_members_rls.sql`
- ❌ Does NOT use raw `join public.project_members` — that pattern was buggy in Fase 6.1 and fixed later; this migration must not repeat the mistake

- [ ] **Step 1: Write migration SQL**

```sql
create table public.labels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index labels_project_idx on public.labels(project_id);

create table public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

create index task_labels_label_idx on public.task_labels(label_id);

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

- [ ] **Step 2: Apply migration**

  Run: `npm run migrate:up` then `npm run migrate:status` — expect `20260908020000_labels` shown as `[applied]`.

- [ ] **Step 3: Update `database.types.ts`**

  Insert new `labels` and `task_labels` blocks into the `Tables` object, right after the existing `task_assignees` block (before the closing brace that ends `Tables`). Follow the exact same hand-written pattern as `task_assignees` (Row/Insert/Update/Relationships: []):

```
labels: {
  Row: { id: string; project_id: string; name: string; color: string; created_at: string }
  Insert: { id?: string; project_id: string; name: string; color: string; created_at?: string }
  Update: { id?: string; project_id?: string; name?: string; color?: string; created_at?: string }
  Relationships: []
}
task_labels: {
  Row: { task_id: string; label_id: string }
  Insert: { task_id: string; label_id: string }
  Update: { task_id?: string; label_id?: string }
  Relationships: []
}
```

  Also append a line to the file's top `ponytail:`-style comment noting the new migration (`20260908020000_labels`), matching the existing comment format.

- [ ] **Step 4: Verify build**

  Run: `npm run build` — expect exit 0.

- [ ] **Step 5: Commit**

  ```
  git add supabase/migrations/20260908020000_labels.sql src/types/database.types.ts
  git commit -m "feat(db): add labels + task_labels tables with RLS for Fase 6.2"
  ```

---

### Task 1: `LabelBadge` component

**Goal:** Small colored pill showing a label's name, with automatic light/dark text contrast against any user-picked background color.

**Files:**
- Create: `src/components/ui/label-badge.tsx`

**Imports needed:**
```
import { cn } from "@/lib/utils"  // verify exact path from an existing ui component file before writing
```

**Reuse check:**
- ✅ No existing badge/pill component for arbitrary background colors — new component justified
- ❌ Do not add a color library dependency; luminance calc is ~5 lines of stdlib math

- [ ] **Step 1: Write component**

```
EXPORT INTERFACE LabelBadgeProps:
  name: string
  color: string          // hex string e.g. "#ef4444"
  className?: string

// ponytail: relative-luminance approximation (not full WCAG contrast formula) —
// good enough for arbitrary user-picked hex colors on a small pill; upgrade to
// full WCAG APCA contrast calc if labels ever need AA-compliance auditing.
FUNCTION getContrastTextColor(hex: string): "#000000" | "#ffffff"
  strip "#", parse r/g/b as 0-255 ints
  luminance = (0.299*r + 0.587*g + 0.114*b) / 255
  RETURN luminance > 0.6 ? "#000000" : "#ffffff"

EXPORT FUNCTION LabelBadge({ name, color, className }: LabelBadgeProps)
  textColor = getContrastTextColor(color)
  RETURN (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium", className)}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  )
```

- [ ] **Step 2: Verify**

  Run: `npm run build && npm run lint` — expect both clean.

- [ ] **Step 3: Commit**

  ```
  git add src/components/ui/label-badge.tsx
  git commit -m "feat(ui): add LabelBadge component with luminance-based text contrast"
  ```

---

### Task 2: `useLabels.ts` hooks

**Goal:** CRUD hooks for label definitions + batch-fetch/toggle hooks for task-label membership, mirroring `useTaskAssignees.ts` exactly.

**Files:**
- Create: `src/features/board/useLabels.ts`

**Imports needed:**
```
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "..."  // exact path — copy from useTaskAssignees.ts import
import type { Database } from "@/types/database.types"
```

**Reuse check:**
- ✅ Mirrors `useTaskAssignees.ts`'s query-key/batch-fetch/toggle-mutation pattern exactly — no new pattern invented
- ❌ Do not duplicate the `Label` shape elsewhere — export it once from this file, import as type where needed (TaskCard/TaskDialog/LabelsDialog)

- [ ] **Step 1: Define `Label` type + query key**

```
EXPORT TYPE Label = Database["public"]["Tables"]["labels"]["Row"]

FUNCTION labelsKey(projectId: string) => ["labels", projectId] as const
FUNCTION taskLabelsKey(projectId: string) => ["task-labels", projectId] as const
```

- [ ] **Step 2: `useLabels(projectId)`**

```
EXPORT FUNCTION useLabels(projectId: string)
  RETURN useQuery({
    queryKey: labelsKey(projectId),
    queryFn: async () => {
      { data, error } = await supabase.from("labels").select("*").eq("project_id", projectId).order("created_at")
      IF error: THROW error
      RETURN data as Label[]
    },
  })
```

- [ ] **Step 3: `useCreateLabel(projectId)`, `useUpdateLabel(projectId)`, `useDeleteLabel(projectId)`**

```
EXPORT FUNCTION useCreateLabel(projectId: string)
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      { error } = await supabase.from("labels").insert({ project_id: projectId, name, color })
      IF error: THROW error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: labelsKey(projectId) }),
    onError: () => toast.error("Gagal membuat label."),
  })

EXPORT FUNCTION useUpdateLabel(projectId: string)
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      { error } = await supabase.from("labels").update({ name, color }).eq("id", id)
      IF error: THROW error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: labelsKey(projectId) }),
    onError: () => toast.error("Gagal mengubah label."),
  })

EXPORT FUNCTION useDeleteLabel(projectId: string)
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: async (id: string) => {
      { error } = await supabase.from("labels").delete().eq("id", id)
      IF error: THROW error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelsKey(projectId) })
      queryClient.invalidateQueries({ queryKey: taskLabelsKey(projectId) })  // cascade removed task_labels rows
    },
    onError: () => toast.error("Gagal menghapus label."),
  })
```

- [ ] **Step 4: `useTaskLabels(projectId)`** — exact 4-step pattern from `useTaskAssignees`

```
EXPORT FUNCTION useTaskLabels(projectId: string)
  RETURN useQuery({
    queryKey: taskLabelsKey(projectId),
    queryFn: async () => {
      // 1. task ids in project
      { data: tasks, error: tasksError } = await supabase.from("tasks").select("id").eq("project_id", projectId)
      IF tasksError: THROW tasksError
      taskIds = tasks.map(t => t.id)
      IF taskIds.length === 0: RETURN {} as Record<string, Label[]>

      // 2. task_labels rows for those tasks
      { data: taskLabelRows, error: tlError } = await supabase.from("task_labels").select("task_id,label_id").in("task_id", taskIds)
      IF tlError: THROW tlError

      // 3. label rows for unique label_ids referenced
      labelIds = [...new Set(taskLabelRows.map(r => r.label_id))]
      IF labelIds.length === 0: RETURN {} as Record<string, Label[]>
      { data: labels, error: labelsError } = await supabase.from("labels").select("*").in("id", labelIds)
      IF labelsError: THROW labelsError
      labelsById = new Map(labels.map(l => [l.id, l]))

      // 4. merge into Record<task_id, Label[]>
      result: Record<string, Label[]> = {}
      FOR row OF taskLabelRows:
        label = labelsById.get(row.label_id)
        IF NOT label: CONTINUE  // skip if label was deleted concurrently
        result[row.task_id] = [...(result[row.task_id] ?? []), label]
      RETURN result
    },
  })
```

- [ ] **Step 5: `useToggleTaskLabel(taskId, projectId)`**

```
EXPORT FUNCTION useToggleTaskLabel(taskId: string, projectId: string)
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: async ({ labelId, isCurrentlyApplied }: { labelId: string; isCurrentlyApplied: boolean }) => {
      IF isCurrentlyApplied:
        { error } = await supabase.from("task_labels").delete().eq("task_id", taskId).eq("label_id", labelId)
      ELSE:
        { error } = await supabase.from("task_labels").insert({ task_id: taskId, label_id: labelId })
      IF error: THROW error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskLabelsKey(projectId) }),
    onError: () => toast.error("Gagal mengubah label."),
  })
```

- [ ] **Step 6: Verify**

  Run: `npm run build && npm run lint` — expect both clean.

- [ ] **Step 7: Commit**

  ```
  git add src/features/board/useLabels.ts
  git commit -m "feat(board): add useLabels CRUD + useTaskLabels/useToggleTaskLabel hooks"
  ```

---

### Task 3: `LabelsDialog` + board menu wiring

**Goal:** Management dialog to create/edit/delete project labels, opened from the board header "..." menu.

**Files:**
- Create: `src/features/board/LabelsDialog.tsx`
- Modify: `src/features/board/BoardPage.tsx`

**Imports needed:**
```
import { useState } from "react"
import { TagIcon, TrashIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { LabelBadge } from "@/components/ui/label-badge"
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, type Label } from "./useLabels"
```

**Reuse check:**
- ✅ Structure mirrors `ArchivedDialog.tsx` (Dialog+DialogContent size="lg", loading Skeletons, EmptyState, mapped rows, ConfirmDialog for delete)
- ❌ Do not use `MembersDialog`'s raw inline-avatar pattern — that's project-membership-specific, not relevant here

- [ ] **Step 1: Write `LabelsDialog.tsx`**

```
INTERFACE LabelsDialogProps:
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void

FUNCTION LabelsDialog({ projectId, open, onOpenChange }: LabelsDialogProps)
  { data: labels, isLoading } = useLabels(projectId)
  createLabel = useCreateLabel(projectId)
  updateLabel = useUpdateLabel(projectId)
  deleteLabel = useDeleteLabel(projectId)

  [editingId, setEditingId] = useState<string | null>(null)
  [editName, setEditName] = useState("")
  [editColor, setEditColor] = useState("#000000")
  [newName, setNewName] = useState("")
  [newColor, setNewColor] = useState("#3b82f6")
  [pendingDelete, setPendingDelete] = useState<Label | null>(null)

  FUNCTION startEdit(label: Label):
    setEditingId(label.id); setEditName(label.name); setEditColor(label.color)

  FUNCTION saveEdit():
    IF NOT editingId OR NOT editName.trim(): RETURN
    updateLabel.mutate({ id: editingId, name: editName.trim(), color: editColor }, { onSuccess: () => setEditingId(null) })

  FUNCTION handleCreate():
    IF NOT newName.trim(): RETURN
    createLabel.mutate({ name: newName.trim(), color: newColor }, { onSuccess: () => { setNewName(""); setNewColor("#3b82f6") } })

  RETURN (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>Labels</DialogTitle></DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {isLoading ? (
            <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>
          ) : (labels?.length ?? 0) === 0 ? (
            <EmptyState icon={<TagIcon size={18} strokeWidth={1.5} aria-hidden />} title="Belum ada label" />
          ) : (
            labels.map((label) => (
              <div key={label.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                IF editingId === label.id:
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="size-8 shrink-0 rounded" aria-label="Label color" />
                  <Button size="sm" onClick={saveEdit}>Save</Button>
                ELSE:
                  <LabelBadge name={label.name} color={label.color} />
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${label.name}`} onClick={() => startEdit(label)}><TagIcon size={14} /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${label.name}`} onClick={() => setPendingDelete(label)}><TrashIcon size={14} /></Button>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line-subtle pt-3">
          <Input placeholder="New label name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="size-8 shrink-0 rounded" aria-label="New label color" />
          <Button onClick={handleCreate} disabled={!newName.trim()}>Add</Button>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.name}"?`}
        description="Label ini akan dihapus dari semua task."
        confirmLabel="Delete"
        onConfirm={() => { if (pendingDelete) deleteLabel.mutate(pendingDelete.id); setPendingDelete(null) }}
      />
    </Dialog>
  )

EXPORT { LabelsDialog }
```

  Note: use icon-button pattern for edit — swap `TagIcon` for a proper edit icon (e.g. `PencilIcon` from lucide-react) if available; pick whatever the codebase already uses for "edit" elsewhere (check `TaskActionsMenu` or similar for the exact icon convention before finalizing).

- [ ] **Step 2: Wire into `BoardPage.tsx`**

  Add state near existing `membersOpen`/`archivedOpen` (around line 91-92):
  ```
  const [labelsOpen, setLabelsOpen] = useState(false)
  ```

  Add `TagIcon` to the existing lucide-react import block (line 26-33).

  Add a new `<MenuItem>` in the board menu, right after Members:
  ```jsx
  <MenuItem onClick={() => setLabelsOpen(true)}>
    <TagIcon /> Labels
  </MenuItem>
  ```

  Import `LabelsDialog` and mount it near the other dialogs (around line 446-459):
  ```jsx
  import { LabelsDialog } from "./LabelsDialog"
  ...
  <LabelsDialog projectId={projectId} open={labelsOpen} onOpenChange={setLabelsOpen} />
  ```

- [ ] **Step 3: Verify**

  Run: `npm run build && npm run lint` — expect both clean.

- [ ] **Step 4: Commit**

  ```
  git add src/features/board/LabelsDialog.tsx src/features/board/BoardPage.tsx
  git commit -m "feat(board): add LabelsDialog for label management"
  ```

---

### Task 4: TaskCard — label pill row

**Goal:** Show a row of colored label pills on each task card, above the assignee avatar stack.

**Files:**
- Modify: `src/features/board/TaskCard.tsx`

**Imports needed (add to existing file):**
```
import { LabelBadge } from "@/components/ui/label-badge"
import { useTaskLabels } from "./useLabels"
```

**Reuse check:**
- ✅ Reuses `LabelBadge` from Task 1, `useTaskLabels` from Task 2
- ✅ Follows exact same independent-hook-call pattern as `useTaskAssignees` in this same file — no prop drilling
- ❌ Do not merge label-fetching into the assignee hook — separate concerns, separate query key

- [ ] **Step 1: Add hook call + labels row**

  Near the existing `useTaskAssignees(projectId)` call:
  ```
  CONST { data: labelsByTask } = useTaskLabels(projectId)     // NEW
  CONST labels = labelsByTask?.[task.id] ?? []                 // NEW
  ```

  In BOTH the overlay branch and the normal branch, insert a labels row right after `{task.title}` and BEFORE the existing `{assignees.length > 0 && <AvatarStack .../>}` line:
  ```jsx
  {labels.length > 0 && (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {labels.map((label) => (
        <LabelBadge key={label.id} name={label.name} color={label.color} />
      ))}
    </div>
  )}
  ```

- [ ] **Step 2: Verify**

  Run: `npm run build && npm run lint` — expect both clean.

- [ ] **Step 3: Commit**

  ```
  git add src/features/board/TaskCard.tsx
  git commit -m "feat(board): show label pills on TaskCard"
  ```

---

### Task 5: TaskDialog — Label chip section

**Goal:** Add a "Label" chip-picker section (same instant-toggle UX as the existing Assignee section) plus a "Manage labels" button.

**Files:**
- Modify: `src/features/board/TaskDialog.tsx`

**Imports needed (add to existing file):**
```
import { LabelBadge } from "@/components/ui/label-badge"
import { useLabels, useTaskLabels, useToggleTaskLabel } from "./useLabels"
import { LabelsDialog } from "./LabelsDialog"
```

**Reuse check:**
- ✅ Reuses `LabelBadge`, `useLabels`, `useTaskLabels`, `useToggleTaskLabel`, `LabelsDialog` — all built in prior tasks
- ✅ Follows the exact rules-of-hooks fix pattern already applied for `useToggleAssignee` — hooks needing `task.id` called with `task?.id ?? ""` fallback BEFORE the early return

- [ ] **Step 1: Add hooks at the top, alongside existing ones (before `if (!task) return null`)**

```
CONST updateTask = useUpdateTask(projectId)                          // existing
CONST { data: members } = useMembers(projectId)                       // existing
CONST { data: assigneesByTask } = useTaskAssignees(projectId)          // existing
CONST toggleAssignee = useToggleAssignee(task?.id ?? "", projectId)    // existing
CONST { data: allLabels } = useLabels(projectId)                       // NEW
CONST { data: labelsByTask } = useTaskLabels(projectId)                // NEW
CONST toggleLabel = useToggleTaskLabel(task?.id ?? "", projectId)      // NEW
```

  Add local state for the manage-labels dialog, also before the early return (hooks + `useState` must stay above it too):
```
CONST [labelsDialogOpen, setLabelsDialogOpen] = useState(false)   // NEW
```

- [ ] **Step 2: After `const currentTask = task`, add derived values + handler**

```
CONST currentLabelIds = new Set(
  (labelsByTask?.[currentTask.id] ?? []).map(l => l.id)
)

FUNCTION handleToggleLabel(labelId: string):
  isCurrentlyApplied = currentLabelIds.has(labelId)
  toggleLabel.mutate({ labelId, isCurrentlyApplied })
```

- [ ] **Step 3: Insert JSX section**

  Insert a new block BETWEEN the existing Assignee `<div>` (ends the section rendering `<Label>Assignee</Label>...`) and the creator/updated-at metadata `<div>`:

```jsx
<div className="flex flex-col gap-2">
  <div className="flex items-center justify-between">
    <Label>Label</Label>
    <Button variant="ghost" size="sm" onClick={() => setLabelsDialogOpen(true)}>
      Manage labels
    </Button>
  </div>
  <div className="flex flex-wrap gap-1.5">
    {(allLabels ?? []).map((label) => {
      isApplied = currentLabelIds.has(label.id)
      RETURN (
        <button
          key={label.id}
          type="button"
          onClick={() => handleToggleLabel(label.id)}
          className={cn("transition-opacity [transition-duration:var(--dur-fast)]", !isApplied && "opacity-40 hover:opacity-70")}
        >
          <LabelBadge name={label.name} color={label.color} />
        </button>
      )
    })}
  </div>
</div>
```

  Mount `LabelsDialog` somewhere in the component's JSX return (e.g. right after the closing `</Dialog>` of the main dialog, as a sibling — check how similar nested dialogs are handled elsewhere, e.g. `ArchivedDialog`'s `ConfirmDialog` sibling pattern):
```jsx
<LabelsDialog projectId={projectId} open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen} />
```

- [ ] **Step 4: Verify**

  Run: `npm run build && npm run lint` — expect both clean.

- [ ] **Step 5: Commit**

  ```
  git add src/features/board/TaskDialog.tsx
  git commit -m "feat(board): add label chip picker to TaskDialog"
  ```

---

### Task 6: Final QA + docs

**Goal:** Verify the full feature builds/lints clean, update project docs to reflect Fase 6.2 completion.

- [ ] **Step 1: Full verify**

  Run: `npm run build && npm run lint` — expect both exit 0 / clean.

- [ ] **Step 2: Manual smoke-check note**

  No test framework in this repo. No new pure-logic file warrants a `*.selfcheck.ts` — `getContrastTextColor` is trivial (same threshold as `hashColor`/`getInitials` in Fase 6.1's Avatar component), and all label CRUD/toggle is I/O verified via build/lint + code review only. Manual E2E (create label, edit color, delete, toggle on task, see pill on card and in dialog) flagged pending-maintainer, same as every prior fase.

- [ ] **Step 3: Update docs**

  `docs/PROGRESS.md` — add a new `## Fase 6.2 — Labels` section (before whatever currently follows Fase 6.1), listing:
  - Plan: `docs/superpowers/plans/2026-09-08-fase6-labels-implementation.md`
  - Spec: `docs/superpowers/specs/2026-09-08-fase6-labels-design.md`
  - Status: Done
  - Task checkboxes with commit hashes (fill in actual hashes after each task commit)
  - QA checklist: build ✅, lint ✅, E2E ⬜ pending-maintainer

  `CHANGELOG.md` — add `## [Fase 6.2] - 2026-09-08` section (before the Fase 6.1 section), with `### Added` (labels table, per-task label pills, label chip picker, LabelsDialog management), `### Notes` (RLS via is_project_member from the start), `### Status` (Shipped).

  `docs/MEMORY.md` — move "Labels" from the Deferred list to a completed/struck-through entry. Add Key Decisions bullets:
  - Labels use free-color-picker (native `<input type="color">`) not a fixed palette, per explicit user choice.
  - `useTaskLabels` mirrors `useTaskAssignees`'s batch-fetch-then-merge pattern exactly — established as the standard shape for any future task-scoped many-to-many feature.

- [ ] **Step 4: Commit docs**

  ```
  git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
  git commit -m "docs: update PROGRESS/CHANGELOG/MEMORY for Fase 6.2"
  ```

- [ ] **Step 5: Final scope-creep check**

  Run: `git status --porcelain` — expect ONLY the 2 pre-existing dirty files (`M index.html`, `?? public/`) remain untracked/modified.

---

## Self-Review Notes

- **Spec coverage:** §2 Data Model → Task 0. §3 Hooks (all 6 functions) → Task 2. §4 UI Components: `LabelBadge` → Task 1, `LabelsDialog` → Task 3, `TaskCard.tsx` modify → Task 4, `TaskDialog.tsx` modify → Task 5. §5 Out of Scope (filter-by-label, label count limit, label reordering) correctly has no task — deferred as specified. §6 Testing → Task 6 Step 2.
- **Reuse violations checked:** No task recreates `Button`/`Input`/`Label`/`Dialog`/`ConfirmDialog`/`Skeleton`/`EmptyState`/`Menu*`. `useTaskLabels`/`useToggleTaskLabel` mirror `useTaskAssignees`/`useToggleAssignee` structurally but are separate functions on a separate table — not duplication, this is the established per-feature hook pattern.
- **Type consistency:** `Label` type defined once in `useLabels.ts`, imported (not redefined) in `LabelsDialog.tsx`, `TaskCard.tsx`, `TaskDialog.tsx`.
- **Hooks-rule fix applied:** `useToggleTaskLabel(task?.id ?? "", projectId)` and `useLabels`/`useTaskLabels` are all called unconditionally before `TaskDialog`'s `if (!task) return null` early return, exactly matching the established Fase 6.1 fix for `useToggleAssignee` — prevents a "rendered fewer hooks than expected" crash when `task` transitions from `null` to a real task.

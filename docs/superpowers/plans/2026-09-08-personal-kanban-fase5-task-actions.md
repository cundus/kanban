# Personal Kanban — Fase 5 (Task Actions, List Actions, Task Detail Upgrade, Archive) Implementation Plan

> Untuk agen pelaksana: REQUIRED SUB-SKILL superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi plan ini task-per-task. Steps pakai checkbox (`- [ ]`) untuk tracking.
>
> Executor model: plan ini ditulis untuk eksekusi mid-level (Sonnet 4.6 / Kimi 2.7 Code). Setiap step punya pseudocode — terjemahkan ke kode nyata, jangan ambil keputusan arsitektur baru. Isi dokumen Bahasa Indonesia; identifier & kode tetap Bahasa Inggris.

**Goal:** Tambah menu aksi task card (right-click desktop + tombol `...` mobile), menu aksi header list, upgrade task detail dialog (lebar, layout 2 kolom, autosave, metadata footer, deep-link), dan fitur archive task (migrasi + hooks + dialog Archived).

**Architecture:** Semua fitur baru menempel di `src/features/board/` yang sudah ada, nol dependensi baru. `ContextMenu` dari `@base-ui/react/context-menu` dipakai untuk right-click; komponen `MenuSubmenu*` baru ditambah ke `src/components/ui/menu.tsx` untuk submenu "Move to list". Archive pakai kolom `archived_at timestamptz` (null = aktif) tanpa soft-delete tabel terpisah. Deep-link pakai `useSearchParams` react-router-dom, param `?task=<uuid>` jadi satu-satunya sumber kebenaran dialog terbuka.

**Tech Stack baru:** Tidak ada. Mulai pakai subpath `@base-ui/react/context-menu`, `Menu.SubmenuRoot`/`Menu.SubmenuTrigger` dari `@base-ui/react/menu`, dan `useSearchParams` dari `react-router-dom` (sudah terinstall, belum pernah dipakai di board).

**Spec:** `docs/superpowers/specs/2026-09-08-personal-kanban-fase5-design.md`

**Supabase project ref:** `nbcgglhxqtgewtoeqbnf`

**Migrasi baru:** `supabase/migrations/20260908000000_task_archive.sql`

**Asumsi eksplisit (agen: hentikan & tanya bila salah):**
- A1: `ContextMenu.Root` dari `@base-ui/react/context-menu` tidak punya prop untuk mematikan long-press. Kalau saat implementasi ternyata ada opsi (`longPress={false}` atau serupa di versi terinstall), matikan long-press agar tidak bentrok dengan `TouchSensor {delay:200}`. Kalau tidak ada opsi, biarkan drag-and-drop menang (jangan hack event listener manual) dan catat di QA manual.
- A2: Nama pembuat task ("Dibuat oleh") diambil dari cache `project_members` (hook `useProjectMembers` — cek keberadaannya di `src/features/members/`; kalau tidak ada hook terekspor, buat query minimal `select user_id, profiles(full_name)` sekali per project, JANGAN join per-task). Fallback tampil "—" kalau member tidak ketemu di cache (misal sudah keluar dari project).
- A3: Header board dikonsolidasi — tombol "Members" dan "Export" existing dicabut dari langsung terlihat, dipindah jadi item di dalam satu `Menu` (`...`) baru bersama "Archived". Back, judul project, Add list, ThemeToggle TETAP terlihat langsung.
- A4: `useDuplicateTask` dan operasi archive TIDAK optimistic (kecuali eksplisit disebutkan optimistic di task di bawah). Delay singkat menunggu response server diterima.

---

## Reuse Map

**Existing components (`src/components/ui/`):**
- `Button` (variants default/destructive/outline/secondary/ghost/link, size default/icon) — `@/components/ui/button`
- `Card` — `@/components/ui/card` (tidak dipakai plan ini)
- `ConfirmDialog` — `@/components/ui/confirm-dialog` (dipakai untuk Delete task, Delete list, Delete permanen arsip)
- `Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription` — `@/components/ui/dialog`
- `EmptyState` — `@/components/ui/empty-state`
- `Input` — `@/components/ui/input`
- `Label` — `@/components/ui/label`
- `Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator` — `@/components/ui/menu`
- `Skeleton` — `@/components/ui/skeleton`
- `Textarea` — `@/components/ui/textarea` (tidak dipakai plan ini, description pakai `MarkdownEditor`)
- `Tooltip` — `@/components/ui/tooltip`

**Existing utilities (`src/lib/`):**
- `cn()` — `@/lib/utils`
- `supabase` client — `@/lib/supabase`
- `formatRelativeTime(date)` — `@/lib/formatRelativeTime`
- `queryClient` — `@/lib/queryClient`

**Existing board-local exports:**
- `Positioned, swapPosition, POSITION_STEP, positionAtEnd, positionBetween, positionForIndex, needsRebalance, rebalance` — `@/features/board/reorderUtils`
- `tasksKey(projectId), useTasks, useCreateTask, useUpdateTask, useDeleteTask, useMoveTask` — `@/features/board/useTasks`
- `listsKey(projectId), useLists, useCreateList, useRenameList, useDeleteList, useReorderList` — `@/features/board/useLists`
- `renderMarkdown` — `@/features/board/markdown`
- `MarkdownEditor` — `@/features/board/MarkdownEditor`
- `TaskCard, ListColumn, TaskDialog` — `@/features/board/*`

**DO NOT recreate these. Import and use them.**

---

## Task 0: Prasyarat (verifikasi baseline, non-code)

- [ ] **Step 1: Baca spec lengkap**

Baca `docs/superpowers/specs/2026-09-08-personal-kanban-fase5-design.md` (313 baris, 13 bagian) sebelum mulai Task 1. Semua keputusan desain di plan ini berasal dari spec tersebut.

- [ ] **Step 2: Verifikasi baseline hijau**

Run:
```bash
npm run build
```
Expected: exit code 0, tanpa error TypeScript/Vite.

- [ ] **Step 3: Buat branch kerja**

```bash
git checkout -b feat/fase5-task-actions
```

- [ ] **Step 4: Verifikasi status migrasi saat ini**

Run:
```bash
npm run migrate:status
```
Expected: 3 migrasi existing (`20260906000000_init_schema`, `20260906010000_fractional_positions`, `20260906020000_project_members_rls`) berstatus applied. Catat urutan — migrasi baru Task 1 harus jadi migrasi ke-4.

---

## Task 1: Migrasi archive + tipe database

**Goal:** Tambah kolom `archived_at` ke tabel `tasks` dan update tipe TypeScript.

**Files:**
- Create: `supabase/migrations/20260908000000_task_archive.sql`
- Modify: `src/types/database.types.ts` (tambah field `archived_at` ke tipe `tasks`)

**Imports needed:** Tidak ada (file SQL murni + edit tipe manual).

**Reuse check:**
- ✅ Pola migrasi mengikuti 3 file existing di `supabase/migrations/` (raw SQL, tanpa DSL).

- [ ] **Step 1: Tulis migrasi SQL**

Isi file `supabase/migrations/20260908000000_task_archive.sql`:
```sql
alter table public.tasks
  add column archived_at timestamptz;

create index tasks_active_by_list_idx
  on public.tasks (list_id, position)
  where archived_at is null;
```
Tanpa backfill — NULL berarti task aktif. Nol perubahan RLS (granularitas baris, policy `tasks` existing sudah menutup semua operasi berbasis `project_id`).

- [ ] **Step 2: Jalankan migrasi**

Run:
```bash
npm run migrate:up
```
Expected: migrasi ke-4 terapply tanpa error. Verifikasi dengan `npm run migrate:status` — 4 migrasi applied.

- [ ] **Step 3: Update tipe TypeScript**

Buka `src/types/database.types.ts`. Cari interface/type untuk tabel `tasks` (bentuk row). Tambahkan field:
```typescript
archived_at: string | null;
```
Pseudocode lokasi field: tepat di bawah `updated_at: string;` pada definisi row `tasks` (dan pada tipe Insert/Update kalau file punya varian terpisah — tambahkan sebagai optional `archived_at?: string | null`).

- [ ] **Step 4: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260908000000_task_archive.sql src/types/database.types.ts
git commit -m "feat(db): add tasks.archived_at column for archive feature"
```

---

## Task 2: Filter task aktif + hooks archive/restore/duplicate

**Goal:** `useTasks` hanya mengembalikan task aktif; tambah `useArchivedTasks`, `useArchiveTask`, `useRestoreTask`, `useDuplicateTask`.

**Files:**
- Modify: `src/features/board/useTasks.ts` (tambah filter `.is("archived_at", null)` di `useTasks`; tambah `useArchiveTask`, `useRestoreTask`, `useDuplicateTask`)
- Create: `src/features/board/useArchivedTasks.ts`

**Imports needed (useArchivedTasks.ts):**
```
FROM "@tanstack/react-query" IMPORT { useQuery }
FROM "@/lib/supabase" IMPORT { supabase }
FROM "./useTasks" IMPORT { tasksKey } — TIDAK dipakai langsung (key arsip terpisah), tapi import type Task kalau diekspor dari useTasks.ts
```

**Reuse check:**
- ✅ `positionBetween` dari `./reorderUtils` — dipakai `useDuplicateTask`.
- ✅ Pola optimistic+rollback dari `useMoveTask` existing — dicontoh persis untuk `useArchiveTask`.
- ❌ `useArchivedTasks`, `useArchiveTask`, `useRestoreTask`, `useDuplicateTask` — belum ada, buat baru.

- [ ] **Step 1: Filter task aktif di `useTasks`**

Di `src/features/board/useTasks.ts`, cari implementasi `useTasks(projectId)`. Pseudocode perubahan query:
```
FUNCTION useTasks(projectId):
  RETURN useQuery({
    queryKey: tasksKey(projectId),
    queryFn: ASYNC () => {
      { data, error } = AWAIT supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)   // BARU — hanya task aktif
        .order("position", { ascending: true })
      IF error: THROW error
      RETURN data
    }
  })
```
Jangan ubah signature atau nama export.

- [ ] **Step 2: Tambah `useDuplicateTask` di `useTasks.ts`**

Pseudocode (letakkan setelah `useDeleteTask`):
```
FUNCTION useDuplicateTask(projectId: string):
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: ASYNC (task: Task) => {
      siblingTasks = queryClient.getQueryData(tasksKey(projectId)) ?? []
      sameListTasks = siblingTasks.filter(t => t.list_id === task.list_id).sort by position asc
      currentIndex = sameListTasks.findIndex(t => t.id === task.id)
      nextSibling = sameListTasks[currentIndex + 1]  // undefined kalau task terakhir
      newPosition = positionBetween(task.position, nextSibling?.position)

      { data: userData } = AWAIT supabase.auth.getUser()
      { data, error } = AWAIT supabase
        .from("tasks")
        .insert({
          list_id: task.list_id,
          project_id: task.project_id,
          title: task.title + " (copy)",
          description_md: task.description_md,
          due_date: task.due_date,
          position: newPosition,
          created_by: userData.user.id,
          archived_at: null,
        })
        .select()
        .single()
      IF error: THROW error
      RETURN data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal menduplikasi task.")
    }
  })
```
Import `useMutation, useQueryClient` dari `@tanstack/react-query` (cek sudah diimport di file — kalau belum, tambahkan `useQueryClient` ke import existing). Import `toast` dari `sonner`. Import `positionBetween` dari `./reorderUtils` (cek sudah diimport — file ini kemungkinan sudah pakai `positionAtEnd` dari file sama, tambahkan `positionBetween` ke import list).

- [ ] **Step 3: Tambah `useArchiveTask` di `useTasks.ts`**

Pseudocode, contoh persis pola optimistic `useMoveTask` existing:
```
FUNCTION useArchiveTask(projectId: string):
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: ASYNC (taskId: string) => {
      { error } = AWAIT supabase
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", taskId)
      IF error: THROW error
    },
    onMutate: ASYNC (taskId) => {
      AWAIT queryClient.cancelQueries({ queryKey: tasksKey(projectId) })
      previousTasks = queryClient.getQueryData(tasksKey(projectId))
      queryClient.setQueryData(tasksKey(projectId), (old) =>
        old?.filter(t => t.id !== taskId) ?? old
      )
      RETURN { previousTasks }
    },
    onError: (err, taskId, context) => {
      IF context?.previousTasks:
        queryClient.setQueryData(tasksKey(projectId), context.previousTasks)
      toast.error("Gagal mengarsipkan task. Perubahan dibatalkan.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
      queryClient.invalidateQueries({ queryKey: [...tasksKey(projectId), "archived"] })
    }
  })
```

- [ ] **Step 4: Tambah `useRestoreTask` di `useTasks.ts`**

Pseudocode:
```
FUNCTION useRestoreTask(projectId: string):
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: ASYNC (taskId: string) => {
      { error } = AWAIT supabase
        .from("tasks")
        .update({ archived_at: null })
        .eq("id", taskId)
      IF error: THROW error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
      queryClient.invalidateQueries({ queryKey: [...tasksKey(projectId), "archived"] })
      toast.success("Task dipulihkan.")
    },
    onError: () => {
      toast.error("Gagal memulihkan task.")
    }
  })
```
Restore mengembalikan task ke `list_id` yang tersimpan di baris (tidak berubah saat archive) — tidak perlu logic tambahan, `list_id` sudah tetap sejak awal.

- [ ] **Step 5: Buat `src/features/board/useArchivedTasks.ts`**

Isi file penuh:
```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function archivedTasksKey(projectId: string) {
  return ["tasks", projectId, "archived"] as const;
}

export function useArchivedTasks(projectId: string) {
  return useQuery({
    queryKey: archivedTasksKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, lists(name)")
        .eq("project_id", projectId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```
Pseudocode alasan `select("*, lists(name)")`: dialog Archived butuh nama list asal per task (§8.3 spec), join lewat foreign key `list_id → lists.id` Supabase PostgREST embed syntax.

- [ ] **Step 6: Ganti `[...tasksKey(projectId), "archived"]` di Step 3/4 dengan `archivedTasksKey(projectId)`**

Kembali ke `useTasks.ts` — import `archivedTasksKey` dari `./useArchivedTasks` dan ganti literal array di `onSettled`/`onSuccess` Step 3 & 4 supaya konsisten satu sumber key (hindari typo key mismatch).

- [ ] **Step 7: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0. Kalau ada unused import warning dari oxlint (`npm run lint`), bersihkan.

- [ ] **Step 8: Commit**

```bash
git add src/features/board/useTasks.ts src/features/board/useArchivedTasks.ts
git commit -m "feat(board): add archive/restore/duplicate task hooks, filter active tasks"
```

---

## Task 3: `MenuSubmenu` di `src/components/ui/menu.tsx` + `context-menu.tsx` baru

**Goal:** Tambah primitif submenu ke `menu.tsx` dan buat wrapper `ContextMenu` baru untuk dipakai `TaskActionsMenu`.

**Files:**
- Modify: `src/components/ui/menu.tsx` (tambah `MenuSubmenu`, `MenuSubmenuTrigger`)
- Create: `src/components/ui/context-menu.tsx`

**Imports needed (menu.tsx tambahan):**
```
FROM "@base-ui/react/menu" IMPORT { Menu as MenuPrimitive } — sudah ada, tambahkan akses .SubmenuRoot dan .SubmenuTrigger dari primitive yang sama
```

**Imports needed (context-menu.tsx):**
```
FROM "@base-ui/react/context-menu" IMPORT { ContextMenu as ContextMenuPrimitive }
FROM "@/lib/utils" IMPORT { cn }
FROM "./menu" IMPORT { MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSubmenu, MenuSubmenuTrigger } — reuse tampilan Popup yang sama
```

**Reuse check:**
- ✅ `MenuContent`, `MenuItem`, `MenuLabel`, `MenuSeparator` — styling Popup dipakai ulang untuk context-menu (konsistensi visual).
- ❌ `MenuSubmenu`, `MenuSubmenuTrigger`, seluruh isi `context-menu.tsx` — belum ada, buat baru.

- [ ] **Step 1: Baca `src/components/ui/menu.tsx` sebelum edit**

File 86 baris. Struktur existing: `Menu = MenuPrimitive.Root`, `MenuTrigger = MenuPrimitive.Trigger`, `MenuContent` (Portal+Positioner align="end" sideOffset={6} z-50, Popup class `elev-overlay min-w-44 rounded-lg border border-line bg-surface-2 p-1 text-ui text-text-2`), `MenuItem` (class `flex h-8 cursor-default items-center gap-2 rounded-md px-2 data-highlighted:bg-surface-3 data-highlighted:text-text-1` + auto-size svg 4), `MenuLabel` (div polos, komentar ponytail existing), `MenuSeparator` (`-mx-1 my-1 h-px bg-line-subtle`).

- [ ] **Step 2: Tambah `MenuSubmenu` dan `MenuSubmenuTrigger`**

Pseudocode, ditambah di akhir file sebelum baris export terakhir (atau tambahkan ke named export list kalau file pakai named export langsung per const):
```
CONST MenuSubmenu = MenuPrimitive.SubmenuRoot

COMPONENT MenuSubmenuTrigger({ className, children, ...props }, ref):
  RETURN (
    <MenuPrimitive.SubmenuTrigger
      ref={ref}
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-md px-2 data-highlighted:bg-surface-3 data-highlighted:text-text-1 [&_svg]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </MenuPrimitive.SubmenuTrigger>
  )
FORWARD_REF MenuSubmenuTrigger
EXPORT { MenuSubmenu, MenuSubmenuTrigger }
```
Class sama persis dengan `MenuItem` supaya trigger submenu terlihat identik dengan item menu biasa (§5.3 spec: "Move to list ▸").

- [ ] **Step 3: Buat `src/components/ui/context-menu.tsx`**

Isi file penuh:
```typescript
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import {
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
} from "./menu";

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

// ponytail: reuse Menu's Popup/Positioner styling via MenuContent instead of
// duplicating class strings — ContextMenu.Popup shares the same visual shell
// as dropdown Menu.Popup in @base-ui/react, so wrapping keeps one source of
// truth. Upgrade path: split styling into shared `menu-shell.ts` if a third
// menu primitive (e.g. select) needs it too.
const ContextMenuContent = MenuContent;
const ContextMenuItem = MenuItem;
const ContextMenuLabel = MenuLabel;
const ContextMenuSeparator = MenuSeparator;
const ContextMenuSubmenu = MenuSubmenu;
const ContextMenuSubmenuTrigger = MenuSubmenuTrigger;

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  ContextMenuSubmenuTrigger,
};
```
CATATAN untuk executor: `MenuContent` di `menu.tsx` dibangun dari `MenuPrimitive.Portal`/`Positioner`/`Popup`. Kalau saat implementasi ternyata `ContextMenuPrimitive.Popup` API-nya berbeda (misal beda nama prop Positioner) sehingga `MenuContent` tidak kompatibel dipakai langsung sebagai children `ContextMenuPrimitive.Portal`, BUAT `ContextMenuContent` versi sendiri meniru struktur `MenuContent` persis tapi pakai `ContextMenuPrimitive.Portal/Positioner/Popup` — JANGAN import silang antar primitive yang tidak kompatibel. Verifikasi ini di Step 4 sebelum lanjut Task 4.

- [ ] **Step 4: Verifikasi build + smoke render**

Run:
```bash
npm run build
```
Expected: exit code 0. Kalau muncul type error dari `ContextMenuPrimitive.Portal` menerima children `MenuContent` yang typenya untuk `MenuPrimitive.Portal`, ikuti CATATAN Step 3 — buat versi native context-menu shell.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/menu.tsx src/components/ui/context-menu.tsx
git commit -m "feat(ui): add MenuSubmenu primitive and context-menu wrapper"
```

---

## Task 4: `TaskActionsMenu` (task card + dialog header)

**Goal:** Satu komponen menu aksi task dipakai di `TaskCard` (context menu + tombol mobile) dan header `TaskDialog`.

**Files:**
- Create: `src/features/board/TaskActionsMenu.tsx`

**Imports needed:**
```
FROM "react" IMPORT { useState }
FROM "lucide-react" IMPORT { MoreHorizontalIcon, PencilIcon, CopyIcon, FolderInputIcon, LinkIcon, ArchiveIcon, TrashIcon }
FROM "sonner" IMPORT { toast }
FROM "@/components/ui/menu" IMPORT { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuSubmenu, MenuSubmenuTrigger }
FROM "@/components/ui/context-menu" IMPORT { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSubmenu, ContextMenuSubmenuTrigger }
FROM "@/components/ui/button" IMPORT { Button }
FROM "@/components/ui/confirm-dialog" IMPORT { ConfirmDialog }
FROM "./useTasks" IMPORT { useDeleteTask, useDuplicateTask, useArchiveTask, Task } — sesuaikan nama tipe Task yang diekspor useTasks.ts (kalau tidak diekspor, import dari "@/types/database.types")
FROM "./useLists" IMPORT { useLists }
FROM "./useTasks" IMPORT { useMoveTask }
FROM "./reorderUtils" IMPORT { positionAtEnd }
```

**Reuse check:**
- ✅ `useMoveTask`, `useDeleteTask`, `useDuplicateTask`, `useArchiveTask` — semua sudah ada dari Task 2.
- ✅ `useLists` — untuk daftar list submenu "Move to list".
- ✅ `ConfirmDialog` — untuk konfirmasi Delete.
- ❌ `TaskActionsMenu` — belum ada, buat baru.

- [ ] **Step 1: Definisikan props dan state**

Pseudocode:
```
INTERFACE TaskActionsMenuProps:
  task: Task
  projectId: string
  variant: "context" | "dropdown"   // "context" = dipakai TaskCard (ContextMenu+trigger), "dropdown" = dipakai dialog header (Menu biasa)
  disableRename?: boolean            // true saat dipakai di dialog header (§7.5 spec: Rename dinonaktifkan di situ)
  onRename: () => void                // callback buka dialog + fokus title (TaskCard yang implementasi; dialog header no-op kalau disableRename)
  children?: ReactNode                // untuk variant "context", children = TaskCard yang dibungkus ContextMenuTrigger
```

- [ ] **Step 2: Implementasi component dengan shared menu items**

Pseudocode:
```
COMPONENT TaskActionsMenu(props):
  DESTRUCTURE { task, projectId, variant, disableRename, onRename, children } from props
  [confirmOpen, setConfirmOpen] = useState(false)

  { data: lists } = useLists(projectId)
  duplicateTask = useDuplicateTask(projectId)
  archiveTask = useArchiveTask(projectId)
  deleteTask = useDeleteTask(projectId)
  moveTask = useMoveTask(projectId)

  FUNCTION handleDuplicate():
    duplicateTask.mutate(task)

  FUNCTION handleCopyLink():
    url = window.location.origin + window.location.pathname + "?task=" + task.id
    TRY:
      AWAIT navigator.clipboard.writeText(url)
      toast.success("Tautan disalin.")
    CATCH:
      toast.error("Gagal menyalin tautan.")

  FUNCTION handleArchive():
    archiveTask.mutate(task.id)

  FUNCTION handleMoveToList(targetListId: string):
    IF targetListId === task.list_id: RETURN
    targetTasks = queryClient cache lookup — SKIP, gunakan positionAtEnd tanpa cache lookup manual:
      newPosition = positionAtEnd([])  // ponytail: asumsi pindah ke akhir list tujuan tanpa membaca isi list tujuan dulu — cukup akurat karena useMoveTask sudah dipakai pola sama di drag-drop cross-list; upgrade path: baca cache tasksKey(projectId) filter listId kalau posisi akhir perlu presisi terhadap task lain yang baru saja pindah bersamaan.
    moveTask.mutate({ taskId: task.id, toListId: targetListId, newPosition })

  FUNCTION handleDeleteConfirm():
    deleteTask.mutate(task.id)
    setConfirmOpen(false)

  menuItemsContent = (
    <>
      IF NOT disableRename:
        <MenuItemOrContextItem onClick={onRename}>
          <PencilIcon /> Rename
        </MenuItemOrContextItem>
      <MenuItemOrContextItem onClick={handleDuplicate}>
        <CopyIcon /> Duplicate
      </MenuItemOrContextItem>
      <SubmenuOrContextSubmenu>
        <SubmenuTriggerOrContextSubmenuTrigger>
          <FolderInputIcon /> Move to list
        </SubmenuTriggerOrContextSubmenuTrigger>
        <MenuPopupForSubmenu>
          FOR EACH list IN (lists ?? []):
            <MenuItemOrContextItem
              disabled={list.id === task.list_id}
              onClick={() => handleMoveToList(list.id)}
            >
              {list.name}
            </MenuItemOrContextItem>
        </MenuPopupForSubmenu>
      </SubmenuOrContextSubmenu>
      <MenuItemOrContextItem onClick={handleCopyLink}>
        <LinkIcon /> Copy link
      </MenuItemOrContextItem>
      <SeparatorOrContextSeparator />
      <MenuItemOrContextItem onClick={handleArchive}>
        <ArchiveIcon /> Archive
      </MenuItemOrContextItem>
      <MenuItemOrContextItem className="text-danger" onClick={() => setConfirmOpen(true)}>
        <TrashIcon /> Delete
      </MenuItemOrContextItem>
    </>
  )

  IF variant === "context":
    RETURN (
      <>
        <ContextMenu>
          <ContextMenuTrigger>{children}</ContextMenuTrigger>
          <ContextMenuContent>{menuItemsContent using ContextMenuItem/ContextMenuSubmenu/ContextMenuSubmenuTrigger/ContextMenuSeparator}</ContextMenuContent>
        </ContextMenu>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Delete task?"
          description={"Task \"" + task.title + "\" akan dihapus permanen."}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
        />
      </>
    )
  ELSE:
    RETURN (
      <>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon" aria-label="Task actions"><MoreHorizontalIcon size={16} /></Button>} />
          <MenuContent>{menuItemsContent using MenuItem/MenuSubmenu/MenuSubmenuTrigger/MenuSeparator}</MenuContent>
        </Menu>
        <ConfirmDialog ...(sama seperti di atas)... />
      </>
    )

EXPORT { TaskActionsMenu }
```
CATATAN untuk executor: karena isi menu identik antara `variant="context"` dan `variant="dropdown"` tapi primitive komponennya beda (`MenuItem` vs `ContextMenuItem`), JANGAN paksa satu JSX block dipakai untuk keduanya kalau tipe komponennya tidak sama persis secara runtime — tulis DUA blok JSX terpisah (satu pakai `Menu*`, satu pakai `ContextMenu*`) dengan handler function yang sama (didefinisikan sekali di atas, dipakai di kedua blok). Ini lebih verbose tapi type-safe, hindari abstraksi generik yang tidak diminta (KISS).

- [ ] **Step 3: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/board/TaskActionsMenu.tsx
git commit -m "feat(board): add TaskActionsMenu for task card and dialog header"
```

---

## Task 5: `ListActionsMenu` + update `ListColumn.tsx`

**Goal:** Menu ramping 3 item di header list (Rename, Add task to top, Delete list); cabut tombol Trash lama.

**Files:**
- Create: `src/features/board/ListActionsMenu.tsx`
- Modify: `src/features/board/ListColumn.tsx`
- Modify: `src/features/board/useTasks.ts` (`useCreateTask` terima posisi opsional)

**Imports needed (ListActionsMenu.tsx):**
```
FROM "lucide-react" IMPORT { MoreHorizontalIcon, PencilIcon, PlusIcon, TrashIcon }
FROM "@/components/ui/menu" IMPORT { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator }
FROM "@/components/ui/button" IMPORT { Button }
FROM "@/components/ui/confirm-dialog" IMPORT { ConfirmDialog }
FROM "react" IMPORT { useState }
```

**Reuse check:**
- ✅ `ConfirmDialog` — dipakai untuk Delete list (sudah ada di `ListColumn.tsx` existing, geser pemakaiannya ke sini atau tetap di `ListColumn.tsx` induk — pilih tetap di `ListColumn.tsx` karena state `confirmOpen` sudah ada di situ, `ListActionsMenu` cukup terima callback `onDeleteRequest`).
- ❌ `ListActionsMenu` — belum ada.

- [ ] **Step 1: Baca `ListColumn.tsx` (155 baris) sebelum edit**

Struktur existing yang relevan: state `isEditingName, name, newTaskTitle, confirmOpen`; header `<h3>` inline-edit judul (klik = masuk edit mode, juga jadi drag handle `useSortable`); tombol Trash dengan `Tooltip label="Delete list"` dibungkus `group-hover/list:opacity-100`; footer Input+Button "Add task"; `ConfirmDialog` delete list pakai `confirmOpen`.

- [ ] **Step 2: Buat `src/features/board/ListActionsMenu.tsx`**

Pseudocode isi:
```
INTERFACE ListActionsMenuProps:
  onRename: () => void          // set isEditingName(true) di parent
  onAddToTop: () => void        // buat task baru posisi atas
  onDeleteRequest: () => void   // buka ConfirmDialog di parent (setConfirmOpen(true))

COMPONENT ListActionsMenu({ onRename, onAddToTop, onDeleteRequest }):
  RETURN (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="List actions"
            className="opacity-0 transition-opacity group-hover/list:opacity-100 sm:opacity-0 max-sm:opacity-100"
          >
            <MoreHorizontalIcon size={14} />
          </Button>
        }
      />
      <MenuContent>
        <MenuItem onClick={onRename}>
          <PencilIcon /> Rename
        </MenuItem>
        <MenuItem onClick={onAddToTop}>
          <PlusIcon /> Add task to top
        </MenuItem>
        <MenuSeparator />
        <MenuItem className="text-danger" onClick={onDeleteRequest}>
          <TrashIcon /> Delete list
        </MenuItem>
      </MenuContent>
    </Menu>
  )

EXPORT { ListActionsMenu }
```
Class `max-sm:opacity-100` memastikan tombol selalu terlihat di bawah breakpoint `sm` (§6 spec — sentuh tak punya hover), konsisten dengan pola tombol `...` mobile pada `TaskCard`.

- [ ] **Step 3: Tambah parameter posisi opsional ke `useCreateTask`**

Di `useTasks.ts`, cari `useCreateTask(listId, projectId)`. Pseudocode perubahan mutationFn:
```
FUNCTION useCreateTask(listId: string, projectId: string):
  queryClient = useQueryClient()
  RETURN useMutation({
    mutationFn: ASYNC ({ title, position }: { title: string; position?: number }) => {
      cachedTasks = queryClient.getQueryData(tasksKey(projectId)) ?? []
      inList = cachedTasks.filter(t => t.list_id === listId)
      finalPosition = position ?? positionAtEnd(inList)   // BARU — pakai position kalau dikasih, kalau tidak fallback ke perilaku lama
      { data: userData } = AWAIT supabase.auth.getUser()
      { data, error } = AWAIT supabase
        .from("tasks")
        .insert({ list_id: listId, project_id: projectId, title, position: finalPosition, created_by: userData.user.id })
        .select()
        .single()
      IF error: THROW error
      RETURN data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
  })
```
CATATAN: cari signature mutationFn existing persis — kalau saat ini `mutate(title: string)` (bukan object), UBAH pemanggil existing (footer "Add" button di `ListColumn.tsx`) supaya kirim `{ title }` bukan `title` langsung, supaya tidak breaking existing call site.

- [ ] **Step 4: Edit `ListColumn.tsx` — cabut tombol Trash, pasang `ListActionsMenu`**

Pseudocode perubahan:
```
IMPORT { ListActionsMenu } from "./ListActionsMenu"
HAPUS import Trash2Icon dan Tooltip kalau tidak dipakai lagi di file ini (cek dulu apakah Tooltip dipakai elemen lain di file — kalau hanya untuk tombol Trash, hapus importnya)

DI header list, GANTI blok:
  <Tooltip label="Delete list">
    <Button size="icon" variant="ghost" className="opacity-0 group-hover/list:opacity-100" onClick={() => setConfirmOpen(true)}>
      <Trash2Icon size={14} />
    </Button>
  </Tooltip>
DENGAN:
  <ListActionsMenu
    onRename={() => setIsEditingName(true)}
    onAddToTop={() => {
      inListTasks = tasks   // props tasks milik list ini, sudah tersedia di scope ListColumn
      topPosition = positionBetween(undefined, inListTasks[0]?.position)
      createTask.mutate({ title: "Untitled", position: topPosition })
      // ponytail: "Untitled" placeholder title karena tidak ada input dialog terpisah untuk add-to-top — task langsung dibuat lalu user rename via dialog. Upgrade path: buka TaskDialog otomatis dengan title field fokus kalau UX ini terasa kasar.
    }}
    onDeleteRequest={() => setConfirmOpen(true)}
  />
IMPORT { positionBetween } from "./reorderUtils" (tambahkan ke import existing dari reorderUtils di file ini kalau belum ada)
```

- [ ] **Step 5: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/board/ListActionsMenu.tsx src/features/board/ListColumn.tsx src/features/board/useTasks.ts
git commit -m "feat(board): add ListActionsMenu, remove standalone delete button, add-to-top support"
```

---

## Task 6: Update `TaskCard.tsx` — bungkus `TaskActionsMenu`

**Goal:** Task card punya right-click menu (desktop) + tombol `...` selalu terlihat (mobile).

**Files:**
- Modify: `src/features/board/TaskCard.tsx`

**Imports needed (tambahan):**
```
FROM "lucide-react" IMPORT { MoreHorizontalIcon } — tambahkan ke import existing
FROM "./TaskActionsMenu" IMPORT { TaskActionsMenu }
```

**Reuse check:**
- ✅ `TaskActionsMenu` dari Task 4.

- [ ] **Step 1: Baca `TaskCard.tsx` (49 baris) sebelum edit**

Struktur existing: `useSortable({id, data:{type:"task", listId}})`, `<article onClick={onOpen}>{task.title}</article>`. Props `{task, listId, onOpen, overlay?}`.

- [ ] **Step 2: Bungkus artikel dengan `TaskActionsMenu variant="context"` + tambah tombol mobile**

Pseudocode:
```
COMPONENT TaskCard({ task, listId, onOpen, overlay, projectId }):
  ... existing useSortable logic tidak berubah ...

  IF overlay:
    RETURN <article ...overlay classes tidak berubah>{task.title}</article>
    // Overlay (drag preview) TIDAK perlu context menu — cegah menu muncul saat drag preview

  RETURN (
    <TaskActionsMenu
      task={task}
      projectId={projectId}
      variant="context"
      onRename={onOpen}   // Rename = buka dialog (spec §5.5: fokus title diatur di TaskDialog sendiri lewat query param atau state fokus — lihat Task 7)
    >
      <article
        {...existing sortable props/style/className}
        onClick={onOpen}
        className="group/card relative ..."  // tambahkan "group/card relative" ke className existing untuk anchor tombol mobile
      >
        {task.title}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Task actions"
          className="absolute right-1 top-1 sm:hidden"
          onClick={(e) => {
            e.stopPropagation()   // WAJIB — cegah trigger onOpen (spec §5.4)
            // ponytail: tombol ini re-trigger context menu programmatically tidak didukung Base UI ContextMenu secara langsung.
            // Solusi: render Menu dropdown TERPISAH (bukan context menu) khusus untuk mobile, memakai TaskActionsMenu variant="dropdown".
          }}
        >
          <MoreHorizontalIcon size={14} />
        </Button>
      </article>
    </TaskActionsMenu>
  )
```
KOREKSI PENTING untuk executor: karena `ContextMenu.Trigger` tidak menyediakan cara membuka popup programatically dari tombol terpisah, tombol mobile `...` HARUS pakai `TaskActionsMenu variant="dropdown"` sendiri (bukan trigger context menu yang sama). Jadi struktur final:
```
RETURN (
  <TaskActionsMenu task={task} projectId={projectId} variant="context" onRename={onOpen}>
    <article {...sortableProps} onClick={onOpen} className="group/card relative ...">
      {task.title}
      <div className="absolute right-1 top-1 sm:hidden" onClick={(e) => e.stopPropagation()}>
        <TaskActionsMenu task={task} projectId={projectId} variant="dropdown" onRename={onOpen} />
      </div>
    </article>
  </TaskActionsMenu>
)
```
`TaskActionsMenu variant="dropdown"` merender trigger tombol `MoreHorizontalIcon` sendiri (sudah didefinisikan Task 4 Step 2 blok `ELSE`) — jangan render `Button` duplikat di `TaskCard`, cukup bungkus dengan `div onClick stopPropagation` supaya klik tombol trigger tidak ikut membuka dialog.

- [ ] **Step 3: Update props `TaskCard` untuk terima `projectId`**

Tambahkan `projectId: string` ke interface props `TaskCard`. Cari semua pemanggil `<TaskCard ... />` (di `ListColumn.tsx` dan `BoardPage.tsx` bagian `DragOverlay`) dan tambahkan prop `projectId={projectId}` di tiap pemanggilan.

- [ ] **Step 4: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/board/TaskCard.tsx src/features/board/ListColumn.tsx src/features/board/BoardPage.tsx
git commit -m "feat(board): wrap TaskCard with context menu + mobile actions button"
```

---

## Task 7: `dialog.tsx` prop `size` + upgrade `TaskDialog.tsx`

**Goal:** Dialog task lebih lebar, layout 2 kolom, autosave per-field, metadata footer, `TaskActionsMenu` di header, fokus title saat Rename.

**Files:**
- Modify: `src/components/ui/dialog.tsx` (tambah prop `size` via CVA)
- Modify: `src/features/board/TaskDialog.tsx`

**Imports needed (dialog.tsx tambahan):**
```
FROM "class-variance-authority" IMPORT { cva, type VariantProps } — cek sudah diimport di file lain (button.tsx pasti pakai ini), tiru pola yang sama
```

**Reuse check:**
- ✅ Pola CVA — tiru dari `src/components/ui/button.tsx` yang sudah pakai `cva` untuk variants.

- [ ] **Step 1: Baca `dialog.tsx` sebelum edit**

Cari definisi `DialogContent` — class existing: `elev-overlay fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-line bg-surface-2 p-4 text-ui text-text-2 duration-100 outline-none sm:max-w-dialog data-open:...`.

- [ ] **Step 2: Tambah CVA variant `size`**

Pseudocode:
```
CONST dialogContentVariants = cva(
  "elev-overlay fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-line bg-surface-2 p-4 text-ui text-text-2 duration-100 outline-none data-open:...(animasi existing tidak berubah)",
  {
    variants: {
      size: {
        default: "sm:max-w-dialog",
        lg: "sm:max-w-2xl",
      },
    },
    defaultVariants: { size: "default" },
  }
)

COMPONENT DialogContent({ className, size, children, ...props }, ref):
  RETURN (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup ref={ref} className={cn(dialogContentVariants({ size }), className)} {...props}>
        {children}
        {existing DialogClose "X" button tidak berubah}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
FORWARD_REF DialogContent, tambahkan prop size?: "default" | "lg" ke tipe props
```
Semua pemanggil `DialogContent` LAIN (selain `TaskDialog`) tidak perlu diubah — default tetap `sm:max-w-dialog` (24rem), backward compatible.

- [ ] **Step 3: Verifikasi build sebelum lanjut TaskDialog**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 4: Baca `TaskDialog.tsx` (135 baris) sebelum edit**

Struktur existing: props `{task, projectId, open, onOpenChange}`; state `isEditing, confirmOpen, title, descriptionMd, dueDate` reset via `useEffect` saat `task` berubah; `if (!task) return null`; `handleSave` panggil `updateTask.mutate` lalu `setIsEditing(false)`; `handleDelete`. `<DialogContent className="max-w-2xl">` (class ini sekarang DIGANTI prop `size="lg"`), body flex-col gap-5 (Due date, Description via `MarkdownEditor`/render), footer Delete kiri + Edit/Save kanan.

- [ ] **Step 5: Rombak `TaskDialog.tsx` — hapus `isEditing`, autosave, layout 2 kolom, metadata, `TaskActionsMenu`**

Pseudocode struktur baru lengkap:
```
IMPORT { useEffect, useRef, useState } from "react"
IMPORT { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
IMPORT { Input } from "@/components/ui/input"
IMPORT { Label } from "@/components/ui/label"
IMPORT { MarkdownEditor } from "./MarkdownEditor"
IMPORT { renderMarkdown } from "./markdown"
IMPORT { useUpdateTask } from "./useTasks"
IMPORT { TaskActionsMenu } from "./TaskActionsMenu"
IMPORT { formatRelativeTime } from "@/lib/formatRelativeTime"
IMPORT { ConfirmDialog } from "@/components/ui/confirm-dialog" — tetap dipakai untuk Delete via TaskActionsMenu, TIDAK perlu state confirmOpen lokal lagi (sudah di dalam TaskActionsMenu)

COMPONENT TaskDialog({ task, projectId, open, onOpenChange, autoFocusTitle }: {
  task: Task | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  autoFocusTitle?: boolean   // BARU — dipicu dari Rename (§3.1 spec deep-link / §5.5 rename)
}):
  [title, setTitle] = useState("")
  [descriptionMd, setDescriptionMd] = useState("")
  [descriptionDirty, setDescriptionDirty] = useState(false)
  [dueDate, setDueDate] = useState("")
  titleInputRef = useRef<HTMLInputElement>(null)
  updateTask = useUpdateTask(projectId)

  useEffect(() => {
    IF task:
      setTitle(task.title)
      setDescriptionMd(task.description_md ?? "")
      setDescriptionDirty(false)
      setDueDate(task.due_date ?? "")
  }, [task?.id])   // reset saat task berganti (dep by id, bukan seluruh object, cegah reset saat autosave update object reference)

  useEffect(() => {
    IF open AND autoFocusTitle AND titleInputRef.current:
      titleInputRef.current.focus()
      titleInputRef.current.select()
  }, [open, autoFocusTitle])

  IF NOT task: RETURN null

  FUNCTION handleTitleBlur():
    trimmed = title.trim()
    IF trimmed === "" OR trimmed === task.title:
      setTitle(task.title)   // kosong atau tidak berubah → revert, tanpa request
      RETURN
    updateTask.mutate(
      { id: task.id, title: trimmed },
      { onError: () => { setTitle(task.title); toast.error("Gagal menyimpan judul.") } }
    )

  FUNCTION handleDueDateBlur():
    IF dueDate === (task.due_date ?? ""):
      RETURN   // tidak berubah → tidak ada request
    updateTask.mutate(
      { id: task.id, due_date: dueDate || null },
      { onError: () => { setDueDate(task.due_date ?? ""); toast.error("Gagal menyimpan tanggal.") } }
    )

  FUNCTION handleDescriptionSave():
    updateTask.mutate(
      { id: task.id, description_md: descriptionMd },
      {
        onSuccess: () => setDescriptionDirty(false),
        onError: () => toast.error("Gagal menyimpan deskripsi.")
      }
    )

  creatorName = lookupCreatorNameFromMemberCache(task.created_by)  // ponytail: implementasi actual di Task 8, di sini panggil hook/util yang disediakan Task 8 — misal useMemberName(task.created_by) mengembalikan string, fallback "—"
  updatedRelative = formatRelativeTime(task.updated_at)

  RETURN (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-heading border-none px-0 shadow-none focus-visible:ring-0"
          />
          <TaskActionsMenu task={task} projectId={projectId} variant="dropdown" disableRename onRename={() => {}} />
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
          <div className="flex flex-col gap-2 md:order-1">
            <Label>Description</Label>
            <MarkdownEditor value={descriptionMd} onChange={(v) => { setDescriptionMd(v); setDescriptionDirty(true) }} />
            IF descriptionDirty:
              <Button size="sm" onClick={handleDescriptionSave}>Save description</Button>
          </div>
          <div className="flex flex-col gap-4 md:order-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input id="task-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} onBlur={handleDueDateBlur} />
            </div>
            <div className="flex flex-col gap-1 text-micro text-text-4">
              <span>Dibuat oleh {creatorName}</span>
              <span>Terakhir diubah {updatedRelative}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

EXPORT { TaskDialog }
```
CATATAN: `handleSave`, `handleDelete`, `isEditing`, `confirmOpen` LAMA semua DIHAPUS — Delete sekarang dipicu lewat `TaskActionsMenu` (Task 4), yang sudah punya `ConfirmDialog` internal. `useUpdateTask` mutationFn HARUS terima partial update (`{id, title}` saja TANPA field lain) — cek signature existing di `useTasks.ts`: kalau saat ini mutationFn butuh SEMUA field (`{id,title,description_md,due_date}` sekaligus), UBAH mutationFn supaya terima `Partial<Task> & {id: string}` dan hanya update field yang dikirim (pakai `supabase.from("tasks").update(fieldsWithoutId).eq("id", id)` — spread object tanpa default kosong untuk field lain).

- [ ] **Step 6: Cari pemanggil `TaskDialog` dan update prop `autoFocusTitle`**

Di `BoardPage.tsx`, komponen `TaskDialogForOpenTask` — tambahkan state/prop untuk meneruskan `autoFocusTitle` dari asal panggilan Rename. Ini disambungkan penuh di Task 8 (deep-link) — untuk task ini cukup tambahkan prop opsional `autoFocusTitle?: boolean` yang diteruskan `false` default dari `BoardPage.tsx` sampai Task 8 menyambungkannya ke `TaskActionsMenu.onRename`.

- [ ] **Step 7: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/dialog.tsx src/features/board/TaskDialog.tsx
git commit -m "feat(board): upgrade TaskDialog with autosave, 2-col layout, wider size"
```

---

## Task 8: Deep-link `?task=<id>`, nama pembuat, hubungkan Rename

**Goal:** `BoardPage.tsx` pakai `useSearchParams`; hook nama pembuat dari cache member; `TaskActionsMenu.onRename` benar-benar buka dialog + fokus title.

**Files:**
- Modify: `src/features/board/BoardPage.tsx`
- Create: `src/features/board/useMemberName.ts`
- Modify: `src/features/board/TaskDialog.tsx` (sambungkan `useMemberName`)
- Modify: `src/features/board/TaskActionsMenu.tsx` (`onRename` benar-benar set query param + autoFocus)

**Imports needed (BoardPage.tsx tambahan):**
```
FROM "react-router-dom" IMPORT { useSearchParams } — tambahkan ke import existing (useNavigate, useParams tetap)
```

**Imports needed (useMemberName.ts):**
```
FROM "@tanstack/react-query" IMPORT { useQuery }
FROM "@/lib/supabase" IMPORT { supabase }
```

**Reuse check:**
- ✅ Cek dulu apakah `src/features/members/` sudah punya hook `useProjectMembers` terekspor (A2 di header plan). Kalau ADA, JANGAN buat `useMemberName.ts` — pakai hook existing dan cukup buat fungsi lookup nama dari hasilnya. Kalau TIDAK ADA hook terekspor, lanjutkan Step di bawah untuk buat `useMemberName.ts` baru.

- [ ] **Step 1: Cek `src/features/members/` untuk hook member existing**

Baca isi folder `src/features/members/` (file `MembersDialog.tsx` dan sekitarnya). Cari apakah ada fungsi/hook yang query `project_members` join `profiles` dan diekspor untuk dipakai ulang. CATAT hasil temuan sebagai keputusan A2 final.

- [ ] **Step 2a (JIKA hook existing ditemukan): reuse**

Import hook tersebut di `TaskDialog.tsx`, panggil dengan `projectId`, cari member dengan `user_id === task.created_by` dari hasilnya, ambil `full_name` atau fallback `email`, fallback akhir `"—"` kalau tidak ketemu.

- [ ] **Step 2b (JIKA tidak ada hook existing): buat `src/features/board/useMemberName.ts`**

Isi file penuh:
```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useProjectMemberNames(projectId: string) {
  return useQuery({
    queryKey: ["project-members-names", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("user_id, profiles(full_name, email)")
        .eq("project_id", projectId)
        .eq("status", "accepted");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of data) {
        map.set(row.user_id, row.profiles?.full_name ?? row.profiles?.email ?? "—");
      }
      return map;
    },
  });
}
```
Di `TaskDialog.tsx`, panggil `const { data: memberNames } = useProjectMemberNames(projectId)`, lalu `creatorName = memberNames?.get(task.created_by) ?? "—"`.

- [ ] **Step 3: `BoardPage.tsx` — ganti `openTaskId` state dengan `useSearchParams`**

Pseudocode perubahan:
```
IMPORT { useSearchParams } from "react-router-dom"

DI komponen BoardPage:
  [searchParams, setSearchParams] = useSearchParams()
  taskIdFromUrl = searchParams.get("task")
  [autoFocusTitle, setAutoFocusTitle] = useState(false)   // BARU — true sesaat setelah Rename diklik

  HAPUS state lama: openTaskId (dan setOpenTaskId) — cari semua penggunaan di file, ganti logic yang tadinya `setOpenTaskId(id)` jadi `setSearchParams({ task: id })`

  FUNCTION handleOpenTask(taskId: string):
    setSearchParams({ task: taskId })

  FUNCTION handleCloseTaskDialog():
    newParams = new URLSearchParams(searchParams)
    newParams.delete("task")
    setSearchParams(newParams, { replace: true })
    setAutoFocusTitle(false)

  FUNCTION handleRename(taskId: string):
    setSearchParams({ task: taskId })
    setAutoFocusTitle(true)
```

- [ ] **Step 4: Validasi id tak ketemu**

Di komponen lokal `TaskDialogForOpenTask` (baris ~390-406 existing), pseudocode:
```
COMPONENT TaskDialogForOpenTask({ taskId, tasks, projectId, onOpenChange, autoFocusTitle }):
  task = tasks.find(t => t.id === taskId) ?? null

  useEffect(() => {
    IF taskId AND NOT task AND tasks.length > 0:
      // id ada di URL tapi tidak ketemu di daftar task yang sudah difetch
      toast.error("Task tidak ditemukan.")
      onOpenChange(false)   // trigger handleCloseTaskDialog di parent, bersihkan param
  }, [taskId, task, tasks.length])

  RETURN <TaskDialog task={task} projectId={projectId} open={!!task} onOpenChange={onOpenChange} autoFocusTitle={autoFocusTitle} />
```
Syarat `tasks.length > 0` mencegah false-positive toast saat data masih loading (`tasks` kosong sementara fetch berjalan).

- [ ] **Step 5: Sambungkan `TaskActionsMenu.onRename` di `TaskCard.tsx` dan header dialog**

Di `TaskCard.tsx`, `onRename` yang sebelumnya `={onOpen}` (Task 6) DIGANTI jadi prop baru diteruskan dari `ListColumn` → `BoardPage`: `onRename={() => onRenameTask(task.id)}` di mana `onRenameTask` diteruskan dari `BoardPage.handleRename` lewat rantai props `BoardPage → ListColumn → TaskCard` (tambahkan prop `onRenameTask: (taskId: string) => void` ke kedua komponen, teruskan apa adanya, sama seperti `onOpenTask` yang sudah ada polanya).

- [ ] **Step 6: Update semua pemanggil `setOpenTaskId`/`openTaskId` lama di `BoardPage.tsx`**

Cari SEMUA referensi `openTaskId` di file (termasuk di JSX render `TaskDialogForOpenTask`) dan ganti dengan `taskIdFromUrl`. Cari SEMUA referensi `setOpenTaskId` dan ganti dengan `handleOpenTask` atau `handleCloseTaskDialog` sesuai konteks (buka vs tutup).

- [ ] **Step 7: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/board/BoardPage.tsx src/features/board/TaskDialog.tsx src/features/board/TaskCard.tsx src/features/board/ListColumn.tsx
git commit -m "feat(board): wire deep-link ?task=<id>, member name lookup, rename autofocus"
```

---

## Task 9: `ArchivedDialog.tsx` + konsolidasi header board

**Goal:** Dialog "Archived" per project dengan Restore + Delete permanen; konsolidasi Members/Export/Archived ke satu menu header.

**Files:**
- Create: `src/features/board/ArchivedDialog.tsx`
- Modify: `src/features/board/BoardPage.tsx` (tambah menu header, state `archivedOpen`)

**Imports needed (ArchivedDialog.tsx):**
```
FROM "react" IMPORT { useState }
FROM "lucide-react" IMPORT { RotateCcwIcon, TrashIcon, ArchiveIcon }
FROM "@/components/ui/dialog" IMPORT { Dialog, DialogContent, DialogHeader, DialogTitle }
FROM "@/components/ui/button" IMPORT { Button }
FROM "@/components/ui/confirm-dialog" IMPORT { ConfirmDialog }
FROM "@/components/ui/empty-state" IMPORT { EmptyState }
FROM "@/components/ui/skeleton" IMPORT { Skeleton }
FROM "@/lib/formatRelativeTime" IMPORT { formatRelativeTime }
FROM "./useArchivedTasks" IMPORT { useArchivedTasks }
FROM "./useTasks" IMPORT { useRestoreTask, useDeleteTask }
```

**Reuse check:**
- ✅ `EmptyState`, `Skeleton`, `ConfirmDialog`, `formatRelativeTime` — semua sudah ada.
- ✅ `useArchivedTasks`, `useRestoreTask`, `useDeleteTask` — dari Task 2.
- ❌ `ArchivedDialog` — belum ada.

- [ ] **Step 1: Implementasi `ArchivedDialog.tsx`**

Pseudocode isi penuh:
```
INTERFACE ArchivedDialogProps:
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void

COMPONENT ArchivedDialog({ projectId, open, onOpenChange }):
  [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  { data: archivedTasks, isLoading } = useArchivedTasks(projectId)
  restoreTask = useRestoreTask(projectId)
  deleteTask = useDeleteTask(projectId)

  FUNCTION handleDeleteConfirm():
    IF taskToDelete:
      deleteTask.mutate(taskToDelete)
      setTaskToDelete(null)

  RETURN (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Archived tasks</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          IF isLoading:
            <Skeleton className="h-12 w-full" /> REPEAT 3x
          ELSE IF archivedTasks.length === 0:
            <EmptyState icon={ArchiveIcon} title="Belum ada task terarsip" />
          ELSE:
            FOR EACH task IN archivedTasks:
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-ui text-text-1 truncate">{task.title}</span>
                  <span className="text-micro text-text-4">
                    {task.lists?.name ?? "Unknown list"} · Diarsipkan {formatRelativeTime(task.archived_at)}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" aria-label="Restore" onClick={() => restoreTask.mutate(task.id)}>
                    <RotateCcwIcon size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete permanently" onClick={() => setTaskToDelete(task.id)}>
                    <TrashIcon size={14} />
                  </Button>
                </div>
              </div>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={!!taskToDelete}
        onOpenChange={(v) => { IF NOT v: setTaskToDelete(null) }}
        title="Delete permanently?"
        description="Task ini akan dihapus permanen dan tidak bisa dipulihkan."
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />
    </Dialog>
  )

EXPORT { ArchivedDialog }
```
`task.lists?.name` mengasumsikan select join Task 2 Step 5 (`select("*, lists(name)")`) mengembalikan field `lists` bertipe `{ name: string } | null` — sesuaikan penamaan field kalau Supabase mengembalikan array (`lists: [{name}]`) bukan object tunggal (perilaku PostgREST tergantung apakah relasi many-to-one dikenali — kalau ternyata array, pakai `task.lists?.[0]?.name`).

- [ ] **Step 2: Konsolidasi header `BoardPage.tsx`**

Pseudocode perubahan header (cari blok `<header>` existing):
```
IMPORT { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu"
IMPORT { MoreVerticalIcon, UsersIcon, DownloadIcon, ArchiveIcon } from "lucide-react"
IMPORT { ArchivedDialog } from "./ArchivedDialog"

TAMBAH state: [archivedOpen, setArchivedOpen] = useState(false)

DI header, GANTI tombol langsung "Members" dan "Export" (Button ghost masing-masing) DENGAN:
  <Menu>
    <MenuTrigger render={<Button variant="ghost" size="icon" aria-label="Board menu"><MoreVerticalIcon size={16} /></Button>} />
    <MenuContent>
      <MenuItem onClick={() => setMembersOpen(true)}>
        <UsersIcon /> Members
      </MenuItem>
      <MenuItem onClick={() => exportProject()}>  // panggil fungsi export existing, cari nama pastinya di file (kemungkinan dari useExportProject)
        <DownloadIcon /> Export
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => setArchivedOpen(true)}>
        <ArchiveIcon /> Archived
      </MenuItem>
    </MenuContent>
  </Menu>

TAMBAH di akhir JSX (sejajar <MembersDialog>, <TaskDialogForOpenTask>):
  <ArchivedDialog projectId={projectId} open={archivedOpen} onOpenChange={setArchivedOpen} />
```
CATATAN: cari nama fungsi export existing tepat (`useExportProject` hook — cek return value-nya, apakah `{ exportProject }` atau `{ mutate }` — sesuaikan pemanggilan `onClick` sesuai API asli hook tersebut, JANGAN asumsikan nama fungsi tanpa verifikasi baca file `useExportProject` dulu).

- [ ] **Step 3: Verifikasi build**

Run:
```bash
npm run build
```
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/board/ArchivedDialog.tsx src/features/board/BoardPage.tsx
git commit -m "feat(board): add ArchivedDialog, consolidate board header into menu"
```

---

## Task akhir: QA + verifikasi + dokumentasi

- [ ] **Step 1: Typecheck + build penuh**

Run:
```bash
npm run build
```
Expected: exit code 0, tanpa error.

- [ ] **Step 2: Lint**

Run:
```bash
npm run lint
```
Expected: exit code 0 atau hanya warning pre-existing yang tidak terkait perubahan ini.

- [ ] **Step 3: Self-check standalone (kalau ada logic baru yang cocok pola `*.selfcheck.ts`)**

Kalau `positionBetween` dipakai dengan cara baru di `useDuplicateTask`/`ListActionsMenu` yang belum tercakup `reorderUtils.selfcheck.ts` existing, TAMBAHKAN assertion baru ke file itu untuk kasus "insert di posisi teratas list kosong" (`positionBetween(undefined, undefined)`). Jalankan:
```bash
node --experimental-strip-types src/features/board/reorderUtils.selfcheck.ts
```
Expected: exit tanpa error/assertion failure.

- [ ] **Step 4: E2E manual bernomor**

1. Desktop (lebar ≥1280): buka board, right-click task card → menu 6 item muncul (Rename, Duplicate, Move to list ▸, Copy link, Archive, Delete).
2. Klik Rename → dialog terbuka, field title ter-fokus & ter-select otomatis.
3. Klik Duplicate → task baru muncul dengan judul `"<asal> (copy)"` tepat di bawah task asal.
4. Klik Move to list ▸ → submenu daftar list muncul, list saat ini disabled; klik list lain → task pindah.
5. Klik Copy link → toast sukses, paste ke address bar baru → dialog task yang sama terbuka via `?task=<id>`.
6. Klik Archive → task hilang dari board.
7. Buka menu header (`...` kanan atas) → Archived → task tadi muncul dengan nama list asal + waktu relatif; klik Restore → task kembali ke list asal di board.
8. Ubah viewport ke 375px (mobile): buka task card — right-click tidak relevan, tombol `...` harus SELALU terlihat di pojok kanan atas card tanpa hover; tekan-tahan card → cek apakah drag menang atau context menu muncul (catat perilaku aktual, cocokkan dengan A1).
9. Di 375px: tap badan card → dialog terbuka (bukan menu). Tap tombol `...` → menu terbuka tanpa membuka dialog (verifikasi `stopPropagation` bekerja).
10. Ubah viewport ke 768px: buka task dialog, cek layout 2 kolom (description kiri lebih lebar, due date+metadata kanan).
11. Di dialog manapun: edit title, klik di luar (blur) → cek tidak ada tombol Save, perubahan tersimpan otomatis (refresh halaman, judul tetap berubah).
12. Edit description → tombol "Save description" muncul; klik → tersimpan; refresh, cek deskripsi ikut berubah.
13. Kosongkan title lalu blur → title kembali ke nilai lama (tidak ada request, cek network tab tidak ada call).
14. Buka menu list (`...` di header ListColumn) → cek hanya 3 item: Rename, Add task to top, Delete list. Tombol Trash lama sudah tidak ada di luar menu.
15. Klik Add task to top → task baru muncul di posisi PALING ATAS list (bukan bawah).
16. Ketik `?task=<uuid-tidak-valid>` manual di URL → toast "Task tidak ditemukan." muncul, param terhapus dari URL, dialog tidak terbuka kosong.

- [ ] **Step 5: Update dokumentasi**

Update `docs/PROGRESS.md` — tambah baris status Fase 5 "merged".
Update `CHANGELOG.md` — tambah entri fitur: task actions menu, list actions menu, task dialog upgrade (autosave, 2-column, deep-link), archive.
Update `docs/MEMORY.md` — catat keputusan A1 (long-press vs drag) hasil observasi Step 4 poin 8, dan keputusan A2 (sumber nama pembuat) hasil Task 8 Step 1.

- [ ] **Step 6: Commit final**

```bash
git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
git commit -m "docs: fase5 task actions status — merged"
```

---

## Self-Review Notes

**Spec coverage:**
- §3.1 migrasi archive → Task 1. ✅
- §4.1 kontrak archived_at → Task 2 Step 1. ✅
- §4.2 deep-link → Task 8 Step 3-6. ✅
- §4.3 judul duplicate → Task 2 Step 2. ✅
- §5.1-§5.4 pemicu menu task card + risiko long-press → Task 6, dicatat sebagai asumsi A1 + QA Step 4 poin 8. ✅
- §5.3 isi 6 item menu → Task 4 Step 2. ✅
- §5.5 useDuplicateTask → Task 2 Step 2. ✅
- §5.6 move to list pakai useMoveTask existing → Task 4 Step 2 `handleMoveToList`. ✅
- §5.7 copy link → Task 4 Step 2 `handleCopyLink`. ✅
- §6 menu list ramping 3 item + add-to-top → Task 5. ✅
- §7.1 prop size dialog → Task 7 Step 1-2. ✅
- §7.2 layout 2 kolom → Task 7 Step 5 grid `md:grid-cols-[1fr_16rem]`. ✅
- §7.3 autosave title/due date blur, description tombol → Task 7 Step 5. ✅
- §7.4 metadata footer → Task 7 Step 5 + Task 8 Step 1-2. ✅
- §7.5 TaskActionsMenu di header dialog, rename disabled → Task 7 Step 5 + Task 4. ✅
- §8.1 filter task aktif → Task 2 Step 1. ✅
- §8.2 hooks archive/restore → Task 2 Step 3-4. ✅
- §8.3 dialog Archived + list_id cascade (tidak ada task yatim) → Task 9. ✅
- §8.4 konsolidasi header → Task 9 Step 2. ✅
- §9 keamanan (RLS existing cukup, clipboard hanya URL sendiri, created_by user saat ini, XSS lewat renderMarkdown existing) → tidak ada task terpisah karena TIDAK ADA endpoint/policy baru yang dibuat — semua operasi lewat tabel `tasks` yang sudah di-RLS. Dicatat di sini sebagai bukti tidak ada gap keamanan.

**Placeholder scan:** Tidak ada "TBD"/"similar to Task N"/"style as needed" — setiap step punya pseudocode konkret atau instruksi verifikasi eksplisit ("cari X, baca dulu, sesuaikan Y berdasarkan hasil baca").

**Konsistensi tipe/nama:** `tasksKey`, `archivedTasksKey`, `useDuplicateTask`, `useArchiveTask`, `useRestoreTask` dipakai konsisten antara Task 2 dan task-task pemakai (4, 6, 9). `TaskActionsMenu` prop `variant: "context" | "dropdown"` konsisten dipakai Task 6 dan Task 7.

**Reuse violations:** Tidak ada — semua komponen UI dasar (`Button`, `Menu*`, `Dialog*`, `ConfirmDialog`, `EmptyState`, `Skeleton`) diimpor dari lokasi existing, tidak ada duplikasi styling di luar `context-menu.tsx` yang memang sengaja reuse `MenuContent` dkk.

**Pseudocode completeness:** Semua step kode (bukan step verifikasi/commit) punya pseudocode lengkap imports+signature+branch+error path+side effect. Tiga titik yang sengaja didelegasikan ke "cek dulu baca file existing" (Task 5 Step 3 signature `useCreateTask`, Task 8 Step 1 hook member existing, Task 9 Step 2 nama fungsi `useExportProject`) BUKAN placeholder — itu instruksi verifikasi eksplisit karena signature pastinya belum dibaca byte-per-byte dalam sesi ini, dan executor WAJIB baca file sebelum menulis kode di titik itu (bukan menebak).

**Ketergantungan urutan aman:** Task 1 (migrasi) harus paling awal karena semua hook Task 2 butuh kolom `archived_at`. Task 3 (menu primitif) sebelum Task 4 (TaskActionsMenu pakai context-menu). Task 4-5 sebelum Task 6-7 (dipakai di situ). Task 8 butuh Task 7 selesai (prop `autoFocusTitle` harus ada di `TaskDialog` dulu). Task 9 independen dari Task 6-8 tapi butuh Task 2 (hooks archive) — aman dikerjakan setelah Task 2.

**Tidak ada dependency baru:** Dikonfirmasi — semua import memakai package yang sudah ada di `package.json` (dicek di (b6) bagian dependencies).

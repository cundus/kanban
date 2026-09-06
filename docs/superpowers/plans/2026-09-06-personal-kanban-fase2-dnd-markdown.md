# Personal Kanban — Fase 2 (Drag & Drop + Markdown Editor) Implementation Plan

> **Untuk agen pelaksana:** REQUIRED SUB-SKILL: gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi plan ini task-by-task. Semua langkah pakai checkbox (`- [ ]`) untuk tracking. Isi dokumen Bahasa Indonesia; identifier & kode tetap Bahasa Inggris.

**Goal:** Ganti reorder tombol ↑↓ dengan drag & drop penuh (`@dnd-kit`) untuk memindah task antar list, reorder task dalam list, dan reorder list. Ubah `position` dari `integer` ke fractional index (`double precision`, midpoint). Jadikan mutasi drag optimistic dengan rollback. Tambah editor markdown write/preview/split di `TaskDialog`. Tanpa perubahan RLS. Output tetap pure static build.

**Architecture:** SPA React 18 + Vite tetap bicara langsung ke Supabase via `@supabase/supabase-js`; otorisasi via RLS `auth.uid()`. TanStack Query mengelola cache + mutation optimistic. `@dnd-kit/core` + `@dnd-kit/sortable` menangani interaksi drag. `marked` (sudah ada) untuk render markdown. `sonner` untuk toast error.

**Tech Stack baru:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `sonner`. Tidak ada library markdown baru.

**Spec:** `docs/superpowers/specs/2026-09-06-personal-kanban-fase2-design.md`

**Supabase project ref:** `nbcgglhxqtgewtoeqbnf`

---

## Task 0: Prasyarat (verifikasi baseline, non-code)

Tidak menyentuh file. Wajib sebelum Task 1.

- [ ] **Step 1: Baca spec Fase 2** (`docs/superpowers/specs/2026-09-06-personal-kanban-fase2-design.md`) sampai paham §3 (data model), §5 (arsitektur DnD), §6 (util), §7 (keputusan toast).

- [ ] **Step 2: Pastikan baseline hijau**

```bash
pnpm install
pnpm exec tsc -b
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: `tsc` exit 0; self-check 4/4 `PASS`.

- [ ] **Step 3: Buat branch kerja**

```bash
git checkout -b fase2-dnd-markdown
```

- [ ] **Step 4: Cek ketersediaan Supabase CLI** (dibutuhkan Task 2 untuk regen types). Jika `supabase --version` gagal, catat: types akan diedit manual mengikuti spec §3.3.

---

## Task 1: Dependencies + Toaster

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `src/App.tsx`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner
```

- [ ] **Step 2: Verifikasi install**

```bash
pnpm list @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities sonner
```

Expected: keempat paket tampil dengan versi, tidak ada `UNMET DEPENDENCY`.

- [ ] **Step 3: Mount `<Toaster />` di `src/App.tsx`**

Tambah import dan render `<Toaster />` sekali di dalam `<BrowserRouter>` (setelah `<Routes>`):

```tsx
import { Toaster } from "sonner"
// ...
      </Routes>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
```

- [ ] **Step 4: Verifikasi build**

```bash
pnpm exec tsc -b && pnpm build
```

Expected: exit 0, `dist/` terisi.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/App.tsx
git commit -m "chore: add @dnd-kit + sonner, mount Toaster"
```

---

## Task 2: Migrasi fractional position + regen types

**Files:**
- Create: `supabase/migrations/20260906010000_fractional_positions.sql`
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: Tulis file migrasi** `supabase/migrations/20260906010000_fractional_positions.sql`

```sql
-- lists.position dan tasks.position: integer -> double precision (fractional index)
alter table lists alter column position type double precision using position::double precision;
alter table lists alter column position set default 1024;

alter table tasks alter column position type double precision using position::double precision;
alter table tasks alter column position set default 1024;

-- re-space baris lama supaya midpoint insert punya ruang (urutan visual dipertahankan)
with ranked as (
  select id, row_number() over (partition by project_id order by position, id) as rn
  from lists
)
update lists set position = ranked.rn * 1024
from ranked where lists.id = ranked.id;

with ranked as (
  select id, row_number() over (partition by list_id order by position, id) as rn
  from tasks
)
update tasks set position = ranked.rn * 1024
from ranked where tasks.id = ranked.id;
```

> JANGAN menyunting `20260906000000_init_schema.sql` (sudah applied ke DB live).

- [ ] **Step 2: Terapkan migrasi ke project live**

Lewat Supabase Dashboard → SQL Editor, paste isi file di atas, Run. Expected: `Success. No rows returned.` (atau jumlah baris ter-update). Verifikasi di Table Editor: kolom `position` pada `lists` dan `tasks` bertipe `double precision`.

- [ ] **Step 3: Regen types**

```bash
supabase gen types typescript --project-id nbcgglhxqtgewtoeqbnf > src/types/database.types.ts
```

Jika CLI tidak tersedia: edit `src/types/database.types.ts` manual — tidak ada perubahan struktural (double precision tetap terpetakan `number`); cukup pastikan komentar `ponytail:` di baris atas dipertahankan. Jika CLI dipakai, tambahkan kembali komentar `ponytail:` di baris atas dan pastikan `position` tetap `number`.

- [ ] **Step 4: Verifikasi typecheck**

```bash
pnpm exec tsc -b
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906010000_fractional_positions.sql src/types/database.types.ts
git commit -m "feat: migrate list/task position to fractional double precision"
```

---

## Task 3: Utilitas fractional index + self-check

**Files:**
- Modify: `src/features/board/reorderUtils.ts`
- Modify: `src/features/board/reorderUtils.selfcheck.ts`

- [ ] **Step 1: Tambah fungsi fractional ke `reorderUtils.ts`** (pertahankan `Positioned` dan `swapPosition` apa adanya)

```typescript
export const POSITION_STEP = 1024
const MIN_GAP = 1e-6

/** Posisi untuk item baru di akhir list (atau list kosong). */
export function positionAtEnd(items: Positioned[]): number {
  if (items.length === 0) return POSITION_STEP
  return Math.max(...items.map((i) => i.position)) + POSITION_STEP
}

/** Posisi di antara dua tetangga. `null` = ujung (tidak ada tetangga). */
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return POSITION_STEP
  if (prev == null) return (next as number) / 2
  if (next == null) return prev + POSITION_STEP
  return (prev + next) / 2
}

/**
 * Posisi untuk menaruh item `movingId` pada indeks `targetIndex` dari daftar
 * ter-sort. Item yang sedang dipindah diabaikan saat menghitung tetangga.
 */
export function positionForIndex(
  items: Positioned[],
  targetIndex: number,
  movingId: string
): number {
  const without = items.filter((i) => i.id !== movingId)
  const clamped = Math.max(0, Math.min(targetIndex, without.length))
  const prev = clamped > 0 ? without[clamped - 1].position : null
  const next = clamped < without.length ? without[clamped].position : null
  return positionBetween(prev, next)
}

/** True bila ada dua tetangga dengan jarak lebih kecil dari MIN_GAP. */
export function needsRebalance(items: Positioned[]): boolean {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].position - sorted[i - 1].position < MIN_GAP) return true
  }
  return false
}

/** Kembalikan semua item dengan position kelipatan POSITION_STEP, urutan tetap. */
export function rebalance<T extends Positioned>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, idx) => ({ ...item, position: (idx + 1) * POSITION_STEP }))
}
```

- [ ] **Step 2: Tambah assert ke `reorderUtils.selfcheck.ts`** (pertahankan 4 assert `swapPosition` yang sudah ada; tambah setelahnya)

```typescript
import {
  swapPosition,
  positionAtEnd,
  positionBetween,
  positionForIndex,
  needsRebalance,
  rebalance,
  POSITION_STEP,
  type Positioned,
} from "./reorderUtils"

// ... assert swapPosition lama tetap ...

const frac: Positioned[] = [
  { id: "a", position: 1024 },
  { id: "b", position: 2048 },
  { id: "c", position: 3072 },
]

assertEqual(positionAtEnd(frac), 4096, "positionAtEnd = last + STEP")
assertEqual(positionAtEnd([]), POSITION_STEP, "positionAtEnd list kosong = STEP")
assertEqual(positionBetween(1024, 2048), 1536, "positionBetween tengah = rata-rata")
assertEqual(positionBetween(null, 1024), 512, "positionBetween awal = first / 2")
assertEqual(positionBetween(3072, null), 4096, "positionBetween akhir = prev + STEP")
assertEqual(
  positionForIndex(frac, 2, "a"),
  positionBetween(2048, 3072),
  "positionForIndex abaikan item yang dipindah"
)

const collapsed: Positioned[] = [
  { id: "x", position: 1000 },
  { id: "y", position: 1000.0000001 },
]
assertEqual(needsRebalance(collapsed), true, "needsRebalance true saat gap kolaps")
assertEqual(needsRebalance(frac), false, "needsRebalance false saat gap lega")
assertEqual(
  rebalance(collapsed).map((i) => i.position),
  [1024, 2048],
  "rebalance menata ulang ke kelipatan STEP"
)

console.log("All reorderUtils self-checks passed.")
```

- [ ] **Step 3: Jalankan self-check**

```bash
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: semua baris `PASS:` lalu `All reorderUtils self-checks passed.`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/board/reorderUtils.ts src/features/board/reorderUtils.selfcheck.ts
git commit -m "feat: add fractional-index position helpers with self-check"
```

---

## Task 4: Refactor query task ke project scope

**Files:**
- Modify: `src/features/board/useTasks.ts`
- Modify: `src/features/board/ListColumn.tsx`
- Modify: `src/features/board/BoardPage.tsx`

- [ ] **Step 1: Ubah `useTasks` menjadi project-scoped**

- Ganti signature `useTasks(listId: string)` → `useTasks(projectId: string)`.
- Query key: `["tasks", projectId]`.
- `queryFn`: `supabase.from("tasks").select("*").eq("project_id", projectId).order("position", { ascending: true })`.
- `useCreateTask(listId, projectId)`: hitung `position` via `positionAtEnd(tasksDalamListIni)` dari cache `["tasks", projectId]` yang difilter `list_id === listId`; `invalidateQueries({ queryKey: ["tasks", projectId] })`.
- `useUpdateTask(projectId)` dan `useDeleteTask(projectId)`: sesuaikan key ke `["tasks", projectId]`.
- Hapus `useReorderTask` (digantikan `useMoveTask` di Task 5).

- [ ] **Step 2: `ListColumn` menerima daftar task via props**

- Hapus `const { data: tasks } = useTasks(list.id)`.
- Tambah prop `tasks: Task[]` (sudah difilter untuk list ini) dari `BoardPage`.
- Hapus tombol ↑↓ dari markup (drag menggantikannya di Task 6).
- `useCreateTask` dipanggil dengan `(list.id, projectId)`.

- [ ] **Step 3: `BoardPage` memusatkan data task**

```tsx
const { data: allTasks } = useTasks(projectId)
const tasksByList = useMemo(() => {
  const map = new Map<string, Task[]>()
  for (const t of allTasks ?? []) {
    const arr = map.get(t.list_id) ?? []
    arr.push(t)
    map.set(t.list_id, arr)
  }
  for (const arr of map.values()) arr.sort((a, b) => a.position - b.position)
  return map
}, [allTasks])
```

Kirim `tasks={tasksByList.get(list.id) ?? []}` ke tiap `<ListColumn>`. `TaskDialogForOpenTask` cari task dari `allTasks`, bukan `useTasks(listId)`.

- [ ] **Step 4: Verifikasi**

```bash
pnpm exec tsc -b
pnpm dev   # buka board: task masih tampil per kolom, tambah task masih jalan
```

Expected: `tsc` exit 0; board render sama seperti sebelum refactor (minus tombol ↑↓).

- [ ] **Step 5: Commit**

```bash
git add src/features/board/useTasks.ts src/features/board/ListColumn.tsx src/features/board/BoardPage.tsx
git commit -m "refactor: project-scoped task query as single DnD source of truth"
```

---

## Task 5: Wiring optimistic di board hooks

**Files:**
- Modify: `src/features/board/useTasks.ts`, `src/features/board/useLists.ts`

- [ ] **Step 1: `useMoveTask(projectId)` di `useTasks.ts`** — satu mutation menangani reorder dalam list DAN pindah antar list

Input: `{ taskId: string; toListId: string; newPosition: number }`.

```typescript
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient()
  const key = ["tasks", projectId] as const
  return useMutation({
    mutationFn: async (input: { taskId: string; toListId: string; newPosition: number }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ list_id: input.toListId, position: input.newPosition })
        .eq("id", input.taskId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      queryClient.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((t) =>
          t.id === input.taskId
            ? { ...t, list_id: input.toListId, position: input.newPosition }
            : t
        )
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
      toast.error("Gagal memindahkan task. Perubahan dibatalkan.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
```

Import `toast` dari `sonner`.

- [ ] **Step 2: `useReorderList(projectId)` di `useLists.ts` → optimistic**

- Ubah input menjadi `{ listId: string; newPosition: number }` (bukan lagi `direction`).
- `mutationFn`: `supabase.from("lists").update({ position: input.newPosition }).eq("id", input.listId)`.
- Tambah `onMutate` (cancel + snapshot + `setQueryData` patch `position`), `onError` (restore + `toast.error("Gagal mengurutkan list. Perubahan dibatalkan.")`), `onSettled` (invalidate). Key: `listsKey(projectId)`.
- Hapus pemakaian `swapPosition` di hook ini (util tetap diekspor untuk self-check).

- [ ] **Step 3: Helper penghitung posisi drop** (boleh di `BoardPage` atau util) memakai `positionForIndex` dari `reorderUtils.ts`. Bila hasil memicu `needsRebalance` pada list tujuan, jalankan `rebalance` + batch `supabase.from(...).upsert(...)` lalu hitung ulang (jarang; boleh ditandai `// rare path`).

- [ ] **Step 4: Verifikasi**

```bash
pnpm exec tsc -b
```

Expected: exit 0. (Belum ada pemicu drag; UI diuji di Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/features/board/useTasks.ts src/features/board/useLists.ts
git commit -m "feat: optimistic move-task and reorder-list mutations with rollback + toast"
```

---

## Task 6: UI drag & drop board (cross-list + within-list)

**Files:**
- Modify: `src/features/board/BoardPage.tsx`, `src/features/board/ListColumn.tsx`, `src/features/board/TaskCard.tsx`

- [ ] **Step 1: `TaskCard` jadi sortable**

```tsx
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
// ...
const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
  useSortable({ id: task.id, data: { type: "task", listId } })
const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
```

Terapkan `ref={setNodeRef}` `style` `{...attributes}` `{...listeners}` di root `Card`. Pertahankan `onClick={onOpen}` — `PointerSensor` `activationConstraint.distance: 5` memisahkan klik dari drag. Hapus sisa tombol ↑↓.

- [ ] **Step 2: `ListColumn` jadi sortable + jadi droppable container task**

- `useSortable({ id: list.id, data: { type: "list" } })` untuk drag kolom (handle di header saja: sebar `listeners` ke elemen judul, bukan seluruh kolom).
- Bungkus daftar task dengan `<SortableContext items={taskIds} strategy={verticalListSortingStrategy}>`.
- Container task harus tetap jadi target drop walau kosong: beri `useDroppable({ id: 'list-dropzone-' + list.id, data: { type: 'list', listId: list.id } })` pada wrapper daftar task, atau pakai pola empty-container `@dnd-kit`.

- [ ] **Step 3: `BoardPage` — `DndContext`**

```tsx
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
```

- `sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))`.
- Bungkus baris kolom dengan `<DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart onDragOver onDragEnd>` dan `<SortableContext items={listIds} strategy={horizontalListSortingStrategy}>`.
- State lokal `activeTask` / `activeList` untuk `<DragOverlay>`.
- **`onDragOver`**: jika `active.data.type === "task"` dan container `over` beda list → update state lokal (`tasksByList` versi draft di `useState`, atau `queryClient.setQueryData` sementara) supaya kartu terlihat berpindah kolom saat hover.
- **`onDragEnd`**:
  - Task: tentukan `toListId` dan `targetIndex` dari `over`; `newPosition = positionForIndex(tasksDiListTujuan, targetIndex, taskId)`; panggil `moveTask.mutate({ taskId, toListId, newPosition })`.
  - List: `targetIndex` dari `over`; `newPosition = positionForIndex(lists, targetIndex, listId)`; panggil `reorderList.mutate({ listId, newPosition })`.
  - Reset `activeTask` / `activeList`.
- `<DragOverlay>` merender `<TaskCard>` / `<ListColumn>` statis untuk item aktif.

- [ ] **Step 4: Verifikasi manual**

```bash
pnpm dev
```

Cek di http://localhost:5173 (board dengan ≥2 list, beberapa task):
1. Seret task ke posisi lain dalam list yang sama → urutan berubah seketika, tetap setelah refresh.
2. Seret task ke list lain → pindah kolom, tetap setelah refresh.
3. Seret task ke list kosong → masuk sebagai satu-satunya kartu.
4. Seret header list ke kiri/kanan → urutan kolom berubah, tetap setelah refresh.
5. Klik (tanpa geser) task → `TaskDialog` tetap terbuka.
6. Di Network tab: satu drag = 1 request `PATCH tasks` (atau + 1 batch rebalance), bukan re-write semua baris.
7. Matikan koneksi / paksa error → kartu balik ke posisi semula + toast merah muncul.

- [ ] **Step 5: `tsc` + commit**

```bash
pnpm exec tsc -b
git add src/features/board/BoardPage.tsx src/features/board/ListColumn.tsx src/features/board/TaskCard.tsx
git commit -m "feat: @dnd-kit drag and drop for tasks (cross-list + reorder) and lists"
```

---

## Task 7: Komponen Markdown editor

**Files:**
- Create: `src/features/board/MarkdownEditor.tsx`
- Modify: `src/features/board/TaskDialog.tsx`

- [ ] **Step 1: Tulis `MarkdownEditor.tsx`**

```tsx
import { useState } from "react"
import { marked } from "marked"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Mode = "write" | "preview" | "split"

export function MarkdownEditor({
  value,
  onChange,
  minRows = 8,
}: {
  value: string
  onChange: (v: string) => void
  minRows?: number
}) {
  const [mode, setMode] = useState<Mode>("write")
  const html = marked.parse(value || "") as string

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(["write", "preview", "split"] as Mode[]).map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={mode === m ? "default" : "ghost"}
            className={m === "split" ? "hidden sm:inline-flex" : undefined}
            onClick={() => setMode(m)}
          >
            {m === "write" ? "Write" : m === "preview" ? "Preview" : "Split"}
          </Button>
        ))}
      </div>

      <div className={mode === "split" ? "grid grid-cols-2 gap-3" : undefined}>
        {(mode === "write" || mode === "split") && (
          <Textarea
            rows={minRows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Markdown supported"
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div
            className="prose prose-sm max-w-none rounded-md border p-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Pakai di `TaskDialog.tsx`**

Ganti blok `<Textarea rows={8} value={descriptionMd} ... />` pada mode `isEditing` dengan:

```tsx
<MarkdownEditor value={descriptionMd} onChange={setDescriptionMd} />
```

Mode view read-only (`task.description_md` dirender via `marked`) TIDAK berubah. Import `MarkdownEditor`.

- [ ] **Step 3: Verifikasi manual**

```bash
pnpm dev
```

1. Buka task → Edit → mode `Write`: ketik `# Judul` dan `- item`.
2. Klik `Preview` → tampil sebagai heading + bullet.
3. Lebarkan window ≥ `sm` → `Split` muncul; edit di kiri, preview kanan ikut berubah live.
4. Save → tutup → buka lagi (view mode) → markdown ter-render, bukan teks mentah.

- [ ] **Step 4: `tsc` + commit**

```bash
pnpm exec tsc -b
git add src/features/board/MarkdownEditor.tsx src/features/board/TaskDialog.tsx
git commit -m "feat: markdown editor with write/preview/split modes in task dialog"
```

---

## Task 8: QA akhir + verifikasi + dokumentasi

**Files:**
- Modify: `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md`

- [ ] **Step 1: Typecheck**

```bash
pnpm exec tsc -b
```

Expected: exit 0.

- [ ] **Step 2: Production build (bukti output static)**

```bash
pnpm build
```

Expected: exit 0, `dist/` hanya HTML/JS/CSS.

- [ ] **Step 3: Self-check util posisi**

```bash
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: semua `PASS`, exit 0.

- [ ] **Step 4: Walkthrough E2E manual** (`pnpm dev`)

- Reorder task dalam list; pindah task antar list; task ke list kosong; reorder list — semua persist setelah refresh.
- Drag gagal (paksa offline) → rollback + toast.
- Network tab: 1–2 request per drag, bukan full re-write.
- Klik task tetap membuka dialog.
- Markdown editor write/preview/split berfungsi; render benar di view mode.

- [ ] **Step 5: RLS regresi (2 akun Google)**

Login akun kedua (incognito) → tidak melihat project akun pertama. Konfirmasi tidak ada regresi RLS dari migrasi Task 2.

- [ ] **Step 6: Update `docs/PROGRESS.md`**

Tandai semua task Fase 2 `[x]`, ubah `Status:` Fase 2 menjadi `done`.

- [ ] **Step 7: Update `CHANGELOG.md`**

```markdown
## [Fase 2] - <tanggal>
### Added
- Drag & drop task antar kolom dan reorder dalam kolom (@dnd-kit)
- Drag & drop untuk mengurutkan kolom/list
- Editor markdown deskripsi task: mode Write / Preview / Split
- Toast error (sonner) untuk kegagalan aksi board

### Changed
- Urutan list/task kini memakai fractional index (double precision) — satu drag hanya meng-update 1–2 baris
- Perpindahan task/list bersifat optimistic dengan rollback saat gagal

### Removed
- Tombol reorder ↑/↓ pada task dan list (digantikan drag & drop)
```

- [ ] **Step 8: Update `docs/MEMORY.md`**

- Di **Key Decisions**: ganti butir "Position column is INTEGER" → "Position kini `double precision` (fractional index, midpoint `POSITION_STEP=1024`), migrasi `20260906010000_fractional_positions.sql`". Ganti butir "Mutations use invalidate-on-success" → "Mutasi board (move task, reorder list) kini optimistic (`onMutate`/`onError`/`onSettled`); CRUD lain masih invalidate-on-success". Ganti butir "No toast library" → "`sonner` ditambahkan di Fase 2 (satu `<Toaster />` di `App.tsx`), dipakai di `onError` mutation board".
- Tambah butir: "`useTasks` kini project-scoped (`['tasks', projectId]`), bukan per-list — jadi satu sumber kebenaran untuk `DndContext`. `useReorderTask` dihapus, diganti `useMoveTask`."
- Di **Deferred**: hapus "Drag & drop, fractional index — Fase 2" dan "Markdown live split-view editor — Fase 2".
- Di **Related Docs**: tambah spec + plan Fase 2.
- Tambah butir: "Sanitasi HTML markdown (DOMPurify) ditunda ke Fase 3 saat konten bisa berasal dari member lain."

- [ ] **Step 9: Commit final**

```bash
git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
git commit -m "docs: mark Fase 2 complete; update changelog and memory"
```

---

## Self-Review Notes

- **Spec coverage:** §2 deps → Task 1. §3 data model + migrasi + regen types → Task 2. §4 RLS (no-op, verifikasi) → Task 8 Step 5. §5 arsitektur DnD + refactor query → Task 4 & 6. §6 util + self-check → Task 3. §7 keputusan toast → Task 1 (mount) + Task 5 (pemakaian). §8 markdown editor → Task 7. §9 development rules → Task 8 Step 6–8 + file plan ini. §10 kriteria sukses → Task 8.
- **Tidak menyentuh migrasi applied:** file baru `20260906010000_fractional_positions.sql`; `20260906000000_init_schema.sql` tidak diubah.
- **Regression guard:** `reorderUtils.selfcheck.ts` diperluas (Task 3) dan dijalankan lagi di Task 8; `swapPosition` + 4 assert lama dipertahankan meski tak lagi dipakai runtime.
- **Urutan aman:** util (Task 3) sebelum hook optimistic (Task 5) sebelum UI drag (Task 6); refactor query (Task 4) mendahului keduanya supaya cache tunggal siap.

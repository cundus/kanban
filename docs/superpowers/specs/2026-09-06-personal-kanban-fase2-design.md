# Personal Kanban — Fase 2 (Drag & Drop + Markdown Editor) Design Spec

> Sumber: `docs/PRD-Personal-Kanban-App.md` §4.4, §4.6, §9 Fase 2; daftar "Deferred" di `docs/MEMORY.md`
> Status: Disetujui untuk implementasi
> Prasyarat: Fase 1 MVP sudah live (https://kanban.cundus.my.id)

## 1. Ringkasan

Fase 2 mengganti reorder tombol ↑↓ dengan **drag & drop penuh** memakai `@dnd-kit`: pindah task antar list, ubah urutan task dalam satu list, dan reorder list secara horizontal. Kolom `position` berubah dari `integer` ke **fractional index** (`double precision`, strategi midpoint) supaya satu drag hanya meng-update satu/dua baris, bukan menulis ulang seluruh kolom. Mutasi drag menjadi **optimistic** (`onMutate`/`onError` rollback). Field deskripsi task mendapat **editor markdown write/preview** (split view di layar lebar) memakai `marked` yang sudah ada. **Tidak ada perubahan RLS.** Ditambahkan `sonner` untuk toast error (justifikasi §7).

Di luar scope Fase 2: invite member & RLS multi-user (Fase 3), import/export JSON (Fase 4), realtime sync, WYSIWYG editor.

## 2. Perubahan Tech Stack

| Area | Fase 1 | Fase 2 |
|---|---|---|
| Drag & drop | tombol ↑↓ + `swapPosition` | `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` |
| Kolom `position` | `integer`, swap nilai tetangga | `double precision`, midpoint fractional index |
| Mutasi board | invalidate-on-success | optimistic: `onMutate` / `onError` / `onSettled` |
| Error UI | tidak ada | `sonner` toast (satu `<Toaster />` di `App.tsx`) |
| Markdown | `Textarea` mentah + render saat view | komponen `MarkdownEditor` write/preview/split, tetap `marked` |

Perkiraan bundle: `@dnd-kit/*` ± 15 KB gzip total (disebut eksplisit di PRD §6), `sonner` ± 5 KB gzip. Tidak ada library markdown baru.

## 3. Perubahan Data Model

Kolom `lists.position` dan `tasks.position`: `integer` → `double precision`. Tipe TypeScript tetap `number`, jadi tidak ada perubahan di kode konsumen (`useLists`, `useTasks`, `reorderUtils`).

### 3.1 Strategi fractional index (midpoint)

- `POSITION_STEP = 1024`.
- Item baru di akhir list: `position = max(position dalam list) + POSITION_STEP` (atau `POSITION_STEP` bila list kosong).
- Sisip antara `prev` dan `next`: `position = (prev + next) / 2`.
- Sisip di awal list: `position = first / 2`.
- **Rebalance:** bila jarak dua tetangga `< 1e-6`, re-space seluruh baris list/kolom terkait ke kelipatan `POSITION_STEP` dalam satu batch `upsert`, lalu hitung ulang. Sangat jarang terjadi pada skala pribadi, tapi wajib ada supaya presisi float tidak habis.

### 3.2 Migrasi baru

JANGAN menyunting migrasi yang sudah applied (`20260906000000_init_schema.sql`). Buat file baru: `supabase/migrations/20260906010000_fractional_positions.sql`

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

Aman untuk data live: perubahan tipe bersifat widening (integer muat penuh di double precision), `UPDATE` hanya menata ulang nilai numerik, urutan visual dipertahankan lewat `order by position, id`. Tidak ada perubahan skema lain, tidak ada kolom di-drop.

### 3.3 Regenerasi types

`supabase gen types typescript --project-id nbcgglhxqtgewtoeqbnf > src/types/database.types.ts`

Touch-up manual diperbolehkan: pertahankan komentar `ponytail:` di baris atas dan bentuk `Views` / `Functions` / `Relationships` bila generator menghasilkan struktur berbeda. Verifikasi `position` tetap terpetakan sebagai `number`.

## 4. Dampak RLS

**Tidak ada — sesuai ekspektasi.** Semua policy `lists` dan `tasks` memakai sub-query ke `projects.owner_id = auth.uid()` lewat `project_id`; tidak ada policy yang menyentuh `position`. `ALTER COLUMN ... TYPE` tidak men-drop atau menyentuh policy. Saat task pindah kolom, `list_id` berubah tetapi selalu ke list dalam project yang sama, sehingga cek kepemilikan lewat `project_id` tetap valid. Tetap diverifikasi manual dengan 2 akun Google di QA (§10).

## 5. Arsitektur Drag & Drop

- Satu `<DndContext>` di `BoardPage`. `sensors = [useSensor(PointerSensor, { activationConstraint: { distance: 5 } })]` supaya klik biasa tetap membuka `TaskDialog` dan tombol rename list tetap berfungsi.
- **Level list (horizontal):** `SortableContext` berisi id semua list dengan `horizontalListSortingStrategy`. `ListColumn` memakai `useSortable`.
- **Level task (vertikal, per kolom):** tiap `ListColumn` membungkus task-nya dalam `SortableContext` dengan `verticalListSortingStrategy`. `TaskCard` memakai `useSortable`.
- **Cross-list:** `onDragOver` mendeteksi container tujuan lewat `active`/`over` `data.current` (`type: "task" | "list"`, `listId`); state lokal task dipindah antar kolom saat hover. `onDragEnd` menghitung `position` final via util fractional (§6) lalu memanggil mutation.
- `<DragOverlay>` merender salinan `TaskCard` / `ListColumn` yang sedang diseret.
- Tombol ↑↓ Fase 1 dihapus dari `TaskCard` dan `ListColumn`. `useReorderTask` (arah up/down) dihapus. `swapPosition` tidak lagi dipakai runtime tetapi tetap diekspor dari `reorderUtils.ts` beserta self-check-nya (regression guard tidak diturunkan).

### 5.1 Bentuk query (refactor terukur dari Fase 1)

`useTasks(listId)` per-kolom diganti menjadi `useTasks(projectId)` yang mengambil **semua task project sekali** (`order by position`). `ListColumn` menerima `tasks` hasil `useMemo` yang mem-filter `list_id`. Alasan: satu cache = satu sumber kebenaran untuk `DndContext`; rollback optimistic pada perpindahan cross-list cukup menyentuh satu entry cache, tidak perlu menyinkronkan dua query terpisah. Query key: `["tasks", projectId]`. Bentuk `useLists(projectId)` tidak berubah.

## 6. Utilitas Fractional Index + Self-check

`src/features/board/reorderUtils.ts` — tambahkan (pertahankan `Positioned` dan `swapPosition`):

- `POSITION_STEP = 1024`
- `positionAtEnd(items: Positioned[]): number`
- `positionBetween(prev: number | null, next: number | null): number` — menangani awal / akhir / tengah / list kosong
- `positionForIndex(items: Positioned[], targetIndex: number, movingId: string): number` — posisi untuk drop pada `targetIndex`, mengabaikan item yang sedang dipindah
- `needsRebalance(items: Positioned[]): boolean` — `true` bila ada gap `< 1e-6`
- `rebalance(items: Positioned[]): Positioned[]` — semua item dengan `position` kelipatan `POSITION_STEP`, urutan dipertahankan

`src/features/board/reorderUtils.selfcheck.ts` — tambahkan assert (pola `assertEqual` + `process.exit(1)` yang sudah ada):

- sisip di akhir → `last + POSITION_STEP`
- sisip di tengah → rata-rata dua tetangga
- sisip di awal → `first / 2`
- list kosong → `POSITION_STEP`
- `positionForIndex` mengabaikan diri sendiri (drag ke bawah dalam list yang sama)
- `needsRebalance` `true` saat gap kolaps; `rebalance` menghasilkan urutan yang sama dengan gap seragam `POSITION_STEP`
- pertahankan 4 assert `swapPosition` lama

Jalankan: `pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts` → semua `PASS`, exit 0.

## 7. Penanganan Error / Toast — Keputusan

**Tambahkan `sonner`.** Fase 1 sengaja menunda toast ("tambah kalau jadi masalah di QA" — `MEMORY.md`). Optimistic update membuat kondisi itu terpenuhi *by design*: saat mutation drag gagal, `onError` mengembalikan snapshot sehingga kartu "meloncat balik" tanpa penjelasan — tanpa feedback, user mengira aplikasi rusak. `sonner` ± 5 KB gzip, tanpa provider tree (cukup satu `<Toaster richColors position="bottom-right" />` di `App.tsx`), API `toast.error(message)`. Dipakai di semua `onError` mutation board (drag task + reorder list) dan boleh dipakai opportunistik di mutation CRUD lain. Ini tetap sejalan dengan prinsip "ringan" PRD §6 (bukan komponen berat).

Sanitasi HTML markdown: konten task hanya milik owner (RLS owner-only di Fase 1 & 2), jadi `marked.parse` + `dangerouslySetInnerHTML` diteruskan seperti Fase 1. Tambahkan DOMPurify sebagai follow-up Fase 3 ketika multi-user (`project_members`) masuk dan konten bisa berasal dari member lain.

## 8. Markdown Editor

Komponen baru `src/features/board/MarkdownEditor.tsx`:

- Props: `value: string`, `onChange: (v: string) => void`, opsional `minRows`.
- Mode via toggle kecil (segmented, pakai `Button` shadcn): `Write` | `Preview`. Di viewport `sm` ke atas tersedia mode ketiga `Split` (textarea kiri + hasil render kanan, sinkron live).
- Render memakai `marked.parse` (sudah ada), `dangerouslySetInnerHTML`, kelas `prose prose-sm max-w-none` (konsisten dengan `TaskDialog` Fase 1).
- `TaskDialog` memakai `MarkdownEditor` menggantikan `Textarea` mentah pada mode edit; mode view read-only tetap merender HTML seperti sekarang.
- Tidak ada dependency baru.

## 9. Development Rules — Kelanjutan (lanjutan spec Fase 1 §7)

Semua aturan §7 spec Fase 1 tetap berlaku tanpa perubahan:

- **Plan Fase 2:** `docs/superpowers/plans/2026-09-06-personal-kanban-fase2-dnd-markdown.md` (task-by-task: file path, kode, cara test).
- **`docs/PROGRESS.md`:** tambah section `## Fase 2`, update tiap task selesai (bukan di-batch di akhir).
- **`CHANGELOG.md`:** entry `## [Fase 2] - <tanggal>` dari sudut pandang user-facing.
- **`docs/MEMORY.md`:** update keputusan yang berubah — `position` kini fractional (bukan integer), mutasi board kini optimistic, `sonner` ditambahkan, `useTasks` kini project-scoped, tombol ↑↓ dihapus. Pindahkan "Drag & drop / fractional index / markdown split-view editor" dari daftar Deferred.
- **Regression guard:** `reorderUtils.selfcheck.ts` wajib hijau sebelum tiap commit yang menyentuh util posisi.

## 10. Kriteria Sukses Fase 2

- Task bisa diseret antar kolom dan di-reorder dalam kolom; urutan persist setelah refresh.
- List bisa di-reorder horizontal via drag.
- Perpindahan terasa instan (optimistic); kegagalan server → kartu kembali ke posisi semula + toast error.
- Hanya 1–2 baris ter-update per drag (cek Network tab), bukan seluruh kolom.
- Kolom `position` bertipe `double precision` di DB; migrasi baru applied; `database.types.ts` sinkron.
- `reorderUtils.selfcheck.ts` hijau; `tsc -b` 0 error; `pnpm build` menghasilkan output static-only.
- Editor markdown write/preview/split berfungsi di `TaskDialog`.
- RLS 2-akun masih mengisolasi project (tidak ada regresi).
- `PROGRESS.md` / `CHANGELOG.md` / `MEMORY.md` terupdate sesuai §9.

# Fase 6.1 — Assignee (Multi-Assignee per Task)

> Sumber: brainstorming 2026-09-08 bersama maintainer.
> Status: desain disetujui, siap dikonversi ke implementation plan.
> Prasyarat: Fase 5 sudah ship & deploy (task actions, archive, task dialog upgrade).

---

## 1. Ringkasan

Fase 6 dipecah jadi sub-fase kecil demi iterasi cepat. Fase 6.1 mengerjakan **assignee**: satu task bisa punya banyak assignee (anggota project), ditampilkan sebagai avatar di task card, dan bisa di-toggle lewat chip picker di task dialog.

**Urutan Fase 6 yang disepakati:** 6.1 Assignee → 6.2 Labels → 6.3 Checklist → 6.4 Task-card ornaments.

**Di luar scope Fase 6.1:**
- Filter board berdasarkan assignee (deferred, sub-fase lain / nanti).
- Notifikasi saat di-assign (sesuai exclusion PRD soal real-time notification).
- Single-assignee constraint — sengaja multi, karena kanban personal ini dipakai kolaboratif kecil-kecilan (bukan formal RACI single-owner).

---

## 2. Perubahan Tech Stack

| Item | Status sekarang | Perubahan Fase 6.1 |
| --- | --- | --- |
| Dependensi baru | — | **Nol.** Semua kebutuhan dipenuhi Supabase-js + TanStack Query yang sudah ada |
| Komponen UI baru | — | `src/components/ui/avatar.tsx` (img + fallback inisial) |

---

## 3. Skema & RLS

Tabel baru `task_assignees` — join table, mirip pola `project_members`.

File: `supabase/migrations/20260908010000_task_assignees.sql`

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

**Kenapa composite PK `(task_id, user_id)`** — tidak ada baris `task_assignees` yang perlu direferensikan sendirian di tempat lain, jadi surrogate `id` cuma overhead. **Kenapa bukan array/JSON column di `tasks`** — hilang FK integrity (bisa nyimpen `user_id` yang udah gak ada di project), susah di-index/join buat query "tugas siapa aja di task ini". `assigned_at` disimpen sekarang karena murah nambahnya, berguna kalau nanti butuh sort/audit trail.

RLS policy meniru pola row-level `is_project_member` yang sudah ada di tabel `tasks` — akses lewat keanggotaan project, bukan kolom per-row.

Setelah migrasi, `src/types/database.types.ts` di-regenerate manual (tulis tangan, sama seperti kolom `archived_at` Fase 5) untuk menambah tabel `task_assignees`.

---

## 4. Hooks

File baru: `src/features/board/useTaskAssignees.ts`, mengikuti pola 2-query-lalu-merge dari `useMembers.ts` (types belum punya relasi FK buat PostgREST embed).

```ts
// Batch fetch: semua assignee untuk semua task di satu project, sekali per board load.
// Kenapa batch per-project (bukan per-task saat dialog dibuka): TaskCard butuh avatar
// stack utk SEMUA card sekaligus render, bukan cuma task yang lagi dibuka dialognya.
function useTaskAssignees(projectId: string): {
  data: Record<string, MemberRow[]> | undefined // key = task_id
  isLoading: boolean
}

// Toggle satu user di satu task (assign kalau belum, unassign kalau udah).
function useToggleAssignee(taskId: string, projectId: string): {
  mutate: (userId: string, isCurrentlyAssigned: boolean) => void
}
```

Implementasi `useTaskAssignees`:
1. Query `task_assignees` where `task_id in (select id from tasks where project_id = :projectId)` — atau lebih simpel: join lewat `tasks.project_id` langsung kalau RLS sudah mem-filter (samain gaya `useMembers`: query flat lalu merge client-side).
2. Query `profiles` untuk semua `user_id` unik yang muncul.
3. Merge → `Record<task_id, MemberRow[]>`.
4. React Query key: `['task-assignees', projectId]`.

Implementasi `useToggleAssignee`:
- `isCurrentlyAssigned` true → `delete from task_assignees where task_id=x and user_id=y`.
- `isCurrentlyAssigned` false → `insert into task_assignees (task_id, user_id)`.
- On success → `invalidateQueries(['task-assignees', projectId])`.
- **Tidak optimistic** — konsisten dengan mayoritas mutation Fase 5 (kecuali `useArchiveTask`). `ponytail:` kalau kerasa lambat pas dipakai nyata, baru upgrade ke optimistic update.

---

## 5. UI

### 5.1 Avatar component — `src/components/ui/avatar.tsx`

```tsx
type AvatarProps = {
  name: string
  src?: string | null
  size?: "sm" | "md" // sm=24px dipakai TaskCard stack, md=32px dipakai TaskDialog chip
}
```

- `src` ada → `<img>` dengan `alt={name}`.
- `src` kosong/gagal load → fallback lingkaran berisi 1-2 huruf inisial dari `name`, warna background di-hash dari `name` (deterministik, biar orang yang sama selalu warna yang sama).
- Dipakai di TaskCard (stack) dan TaskDialog (chip). `MembersDialog.tsx` boleh migrasi pakai ini juga nanti, tidak wajib di Fase 6.1 (tidak menyentuh file itu supaya scope tetap kecil).

### 5.2 TaskCard — avatar stack

Baris kecil di bawah title task, avatar overlap style (`-space-x-2`), tampil maksimal 3 avatar + badge `+N` kalau assignee lebih dari 3. Data diambil dari `useTaskAssignees(projectId)` hasil lookup by `task.id` — TaskCard **tidak fetch sendiri**, data sudah di-load sekali di level board/list dan diteruskan sebagai prop atau dibaca dari cache query yang sama.

Tidak render apa pun kalau assignee kosong (tidak ada empty-state di card, cuma hilang barisnya).

### 5.3 TaskDialog — chip picker

Section baru di kolom kanan (`md:grid-cols-[1fr_16rem]`), di bawah due-date input, di atas metadata footer (creator/updated-at):

```
Assignee
[👤 Nama A] [👤 Nama B] [👤 Nama C] ...
```

- List semua member project (dari `useMembers(projectId)` yang sudah di-load di TaskDialog untuk creator lookup — tidak perlu fetch baru).
- Chip assigned → solid background + border highlight.
- Chip belum assigned → outline/muted.
- Klik chip → langsung `useToggleAssignee(taskId, projectId).mutate(userId, isCurrentlyAssigned)`. Tidak ada tombol Save terpisah — klik chip = commit langsung (beda dari pola autosave-on-blur title/due-date, karena klik toggle sudah jelas merupakan intent final, bukan draft yang perlu di-blur dulu).

---

## 6. Testing

Tidak ada test framework di repo ini (konsisten Fase 1-5) — verifikasi lewat `npm run build` + `npm run lint`. Tidak ada logic murni baru yang butuh selfcheck-style assertion terpisah (beda dengan `reorderUtils.ts` yang murni fungsi matematis) — toggle assignee adalah mutation I/O, diverifikasi manual + lewat review diff.

---

## 7. Ringkasan Keputusan

1. Multi-assignee per task, bukan single.
2. Schema: join table `task_assignees(task_id, user_id, assigned_at)`, composite PK, RLS ikut pola `project_members`.
3. Tidak ada notifikasi saat assign.
4. Filter board by assignee — deferred, di luar scope Fase 6.1.
5. Avatar assignee tampil di TaskCard sekarang (tidak ditunda ke sub-fase ornaments).
6. UI picker = inline toggle chip di TaskDialog kolom kanan (bukan dropdown/popover).
7. Komponen baru `src/components/ui/avatar.tsx`, dipakai TaskCard + TaskDialog.
8. Hook baru: `useTaskAssignees` (batch per-project, dipakai board+card+dialog), `useToggleAssignee` (per-task mutation, non-optimistic).
9. Migrasi baru: `supabase/migrations/20260908010000_task_assignees.sql`.

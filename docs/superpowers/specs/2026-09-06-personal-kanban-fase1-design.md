# Personal Kanban — Fase 1 (MVP) Design Spec

> Sumber: `docs/PRD-Personal-Kanban-App.md` §9 Fase 1
> Status: Disetujui untuk implementasi

## 1. Ringkasan

Fase 1 = MVP single-user. Satu owner login via Google, CRUD project/list/task, urutan diatur manual (tombol naik/turun — belum drag-drop), deskripsi task markdown (textarea untuk edit, di-render jadi HTML saat view). Tanpa invite member, tanpa RLS multi-user, tanpa import/export JSON — semua itu fase berikutnya.

## 2. Tech Stack

| Layer | Pilihan |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling/UI | Tailwind CSS + shadcn/ui |
| Data fetching | TanStack Query |
| Routing | React Router |
| Backend | Supabase (Postgres + Auth + RLS), akses langsung via `supabase-js` |
| Package manager | pnpm |
| Testing | Tanpa framework formal di Fase 1 — verifikasi manual. Regression guard minimal (assert-based) untuk logic non-trivial (mis. urutan posisi) |
| Markdown render | `marked` |

## 3. Struktur Folder

```
personal-kanban/
├── docs/
│   ├── PRD-Personal-Kanban-App.md
│   ├── superpowers/
│   │   ├── specs/YYYY-MM-DD-<topic>-design.md
│   │   └── plans/YYYY-MM-DD-<feature>.md
│   ├── PROGRESS.md          # tracker progress per task/plan
│   └── MEMORY.md            # context carry-over antar sesi/agent
├── CHANGELOG.md              # log tiap perubahan yang sudah diimplementasi
├── supabase/
│   └── migrations/*.sql      # schema + RLS policy
├── src/
│   ├── main.tsx
│   ├── App.tsx                        # Router setup
│   ├── lib/
│   │   ├── supabase.ts                # Supabase client init
│   │   └── queryClient.ts             # TanStack Query client
│   ├── types/
│   │   └── database.types.ts          # generated via `supabase gen types`
│   ├── features/
│   │   ├── auth/                      # Login page, useAuth hook, AuthGuard
│   │   ├── projects/                  # Project list page, CRUD hooks, ProjectCard
│   │   └── board/                     # Board page, List, TaskCard, TaskDialog, reorder hooks
│   ├── components/ui/                 # shadcn/ui generated components
│   └── routes/                        # route definitions (/, /login, /projects/:id)
├── .env.example
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

## 4. Data Model (Fase 1)

Skema disederhanakan dari PRD §7.1 — tabel `project_members` sengaja ditunda ke Fase 3 (invite member). RLS Fase 1 pakai `owner_id` langsung.

```sql
profiles (id uuid PK = auth.users.id, email text, full_name text, avatar_url text)
projects (id uuid PK, name text, description text, owner_id uuid FK->auth.users, created_at timestamptz)
lists    (id uuid PK, project_id uuid FK->projects, name text, position integer)
tasks    (id uuid PK, list_id uuid FK->lists, project_id uuid FK->projects,
          title text, description_md text, due_date date nullable,
          position integer, created_by uuid FK->auth.users, updated_at timestamptz)
```

RLS: user hanya boleh select/insert/update/delete row di `projects`/`lists`/`tasks` yang `project_id`-nya (atau `id` untuk `projects`) dimiliki oleh `owner_id = auth.uid()`.

Posisi pakai **integer** di Fase 1 (bukan fractional index — itu baru dibutuhkan pas drag-drop Fase 2). Reorder = swap/shift integer via tombol ↑↓.

## 5. Fitur & Flow

1. **Login**: halaman `/login` → tombol "Login with Google" → Supabase OAuth → redirect ke `/`.
2. **Project list** (`/`): daftar project milik user, tombol create/edit/delete, klik project → masuk board.
3. **Board** (`/projects/:id`): kolom-kolom (`lists`) berjajar, tiap kolom punya task card. Tombol tambah list, tambah task, edit/hapus list & task. Tiap list/task punya tombol ↑↓ untuk reorder (update `position` integer, swap dengan tetangga).
4. **Task detail/edit**: dialog berisi title, description_md (textarea saat edit), due_date. Saat view-only (dialog belum masuk mode edit), `description_md` dirender jadi HTML via `marked`.

## 6. Out of Scope (Fase 1)

Drag & drop, fractional index, markdown live split-view, invite member, RLS multi-user (`project_members`), import/export JSON, due date reminder, label/tag, dark mode, attachment.

## 7. Development Rules (berlaku sepanjang project, semua fase)

Untuk menjaga kontinuitas kerja lintas sesi/agent, setiap fase pengembangan WAJIB mengikuti aturan berikut:

### 7.1 Planning docs per fase
- Setiap fase (Fase 1, 2, 3, ...) punya implementation plan sendiri di `docs/superpowers/plans/YYYY-MM-DD-<fase-name>.md`, ditulis pakai skill `writing-plans` sebelum mulai coding fase tersebut.
- Plan berisi task-by-task breakdown (file path, kode, cara test) — lihat format skill `writing-plans`.

### 7.2 Progress tracker — `docs/PROGRESS.md`
- Satu file tracker global, di-update tiap kali sebuah task dari plan selesai dikerjakan (bukan di-batch di akhir).
- Format per fase:
  ```markdown
  ## Fase 1 — MVP
  Plan: docs/superpowers/plans/2026-09-06-fase1-mvp.md
  Status: in-progress | done

  - [x] Task 1: Setup Vite + Supabase client
  - [ ] Task 2: Auth (Google login)
  - [ ] Task 3: Project CRUD
  ...
  ```
- Tujuan: siapa pun (agent baru/sesi baru) bisa lihat sekilas fase mana yang sedang jalan dan task mana yang sudah kelar.

### 7.3 `CHANGELOG.md`
- Format [Keep a Changelog](https://keepachangelog.com/) sederhana, grup per fase/tanggal.
- Tiap kali fitur/perbaikan selesai diimplementasi (bukan tiap commit kecil), tambah entry ringkas:
  ```markdown
  ## [Fase 1] - 2026-09-06
  ### Added
  - Login Google via Supabase Auth
  - Project CRUD (create/read/update/delete)
  ```
- Ditulis dari sudut pandang user-facing change, bukan detail implementasi internal.

### 7.4 Memory doc — `docs/MEMORY.md`
- Dokumen context carry-over supaya kalau ganti sesi/agent, tidak perlu re-explore dari nol.
- Isi minimal:
  - Keputusan desain penting yang sudah diambil beserta alasannya (mis. "posisi pakai integer dulu di Fase 1, upgrade ke fractional index di Fase 2 — lihat spec §4")
  - Konvensi/pattern yang dipakai di codebase (naming, struktur folder, cara testing)
  - Hal yang sengaja DITUNDA dan kenapa (supaya tidak salah diimplementasi ulang atau dianggap "lupa")
  - Link ke spec/plan/PRD terkait
- Di-update setiap ada keputusan baru yang berdampak lintas sesi (bukan tiap task kecil).

### 7.5 Ringkasan alur dokumen per fase
```
1. Tulis/update spec di docs/superpowers/specs/ (skill: brainstorming)     — jika ada perubahan desain
2. Tulis plan di docs/superpowers/plans/ (skill: writing-plans)            — sebelum mulai coding fase
3. Eksekusi plan, update docs/PROGRESS.md tiap task selesai
4. Update CHANGELOG.md tiap fitur/perbaikan selesai
5. Update docs/MEMORY.md tiap ada keputusan penting/hal ditunda
```

## 8. Kriteria Sukses Fase 1

- User bisa login Google, CRUD project, CRUD list, CRUD task, reorder manual via tombol, lihat markdown ter-render di task detail.
- RLS aktif: user cuma bisa akses project miliknya sendiri (verifikasi manual dengan 2 akun Google berbeda — akun kedua tidak boleh lihat project akun pertama).
- `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md` ada dan terisi sesuai §7.
- Tidak ada proses backend tambahan di VPS (murni static build).

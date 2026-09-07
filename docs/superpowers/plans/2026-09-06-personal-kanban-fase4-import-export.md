# Personal Kanban — Fase 4 (Import & Export JSON) Implementation Plan

> **Untuk agen pelaksana:** REQUIRED SUB-SKILL: gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi plan ini task-by-task. Semua langkah pakai checkbox (`- [ ]`) untuk tracking. Isi dokumen Bahasa Indonesia; identifier & kode tetap Bahasa Inggris.

**Goal:** Tambah fitur **Export** (dari header board: unduh satu file `.json` berisi project + lists + tasks + metadata versi/timestamp, untuk owner & member) dan **Import** (dari daftar project: upload file `.json` hasil export v1 → validasi & normalisasi di client → insert sebagai **project baru** milik user yang meng-import). Semua **100% di client** (PRD §4.5). **Tanpa migrasi DB, tanpa dependency baru, tanpa perubahan RLS.** Import memanfaatkan policy Fase 3 apa adanya: `projects` INSERT (`owner_id = auth.uid()`) → trigger `on_project_created` menambah baris owner `accepted` → `lists`/`tasks` INSERT lolos `is_project_member`.

**Architecture:** SPA React 18 + Vite bicara langsung ke Supabase via `@supabase/supabase-js`; otorisasi via RLS Fase 3. Fitur baru di `src/features/import-export/`. Dua fungsi murni yang di-self-check (`buildExport`, `validateImport`/`normalizeImport`) mengikuti pola `reorderUtils.ts` + `reorderUtils.selfcheck.ts`. Download via `Blob` + `URL.createObjectURL`. Import insert berurutan dengan **rollback-by-delete** (hapus project → `on delete cascade` membersihkan lists/tasks) — tanpa RPC.

**Tech Stack baru:** tidak ada. `JSON.parse/stringify`, `Blob`, `URL.createObjectURL`, `<input type="file">` semua bawaan browser.

**Spec:** `docs/superpowers/specs/2026-09-06-personal-kanban-fase4-design.md`

**Supabase project ref:** `nbcgglhxqtgewtoeqbnf`

**Migrasi baru:** TIDAK ADA. (Opsi RPC `import_project(jsonb)` sengaja tidak diambil — lihat spec §7.4 & §11 pertanyaan 2. Jangan buat migrasi kecuali maintainer menjawab "ya" ke pertanyaan itu.)

**Asumsi eksplisit (agen: hentikan & tanya bila salah):**

- A1. Format file native v1 saja yang diterima saat import (`format === "personal-kanban-export"`, `version === 1`). JSON generik ditolak dengan pesan ramah. (Spec §11 pertanyaan 3.)
- A2. Import **selalu** membuat project baru; tidak ada merge ke project existing di v1. (Spec §11 pertanyaan 1.)
- A3. Atomicity via rollback-by-delete di client, bukan RPC. (Spec §11 pertanyaan 2.)
- A4. Tombol Export hanya di header `BoardPage`; tidak di `ProjectCard`. (Spec §11 pertanyaan 4.)
- A5. Format v1 tidak menyertakan `id` apa pun. (Spec §11 pertanyaan 5.)
- A6. Batas: file ≤ 2 MB, ≤ 100 list, ≤ 2.000 task, deskripsi task ≤ 20.000 char, deskripsi project ≤ 2.000 char. (Spec §11 pertanyaan 6.)
- A7. `tasks` tidak punya kolom `created_at` (hanya `updated_at`); format menyimpan `updated_at` per task sebagai field informasional.
- A8. Export & Import tersedia untuk semua user terautentikasi (export: owner + member; import: siapa pun, karena jadi owner project baru).

---

## Task 0: Prasyarat (verifikasi baseline, non-code)

Tidak menyentuh file `src/`. Wajib sebelum Task 1.

- [ ] **Step 1: Baca spec Fase 4** (`docs/superpowers/specs/2026-09-06-personal-kanban-fase4-design.md`) — pahami §4 (format file), §5 (export), §6 (import: validasi/normalisasi/insert/rollback), §7 (keamanan), §8 (lokasi file), §11 (pertanyaan terbuka).

- [ ] **Step 2: Baca ulang** `docs/PRD-Personal-Kanban-App.md` §4.5, §5, §7.3, §9; dan `docs/MEMORY.md` (butir "Deferred: Import/export JSON — Fase 4", pola `SECURITY DEFINER` Fase 3, DOMPurify `renderMarkdown`, konvensi feature folder + one-hook-per-operation).

- [ ] **Step 3: Konfirmasi jawaban maintainer atas Spec §11** (pertanyaan 1–6). Bila belum dijawab, lanjut dengan asumsi A1–A8 dan catat di PR/laporan bahwa keputusan bisa berubah.

- [ ] **Step 4: Pastikan baseline hijau**

```bash
pnpm install
pnpm exec tsc -b
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: `tsc` exit 0; self-check semua `PASS`.

- [ ] **Step 5: Branch kerja** — `fase4-import-export` (sudah dibuat saat planning). Bila mulai dari nol: `git checkout -b fase4-import-export main`.

- [ ] **Step 6: Verifikasi tidak perlu migrasi** — cek `supabase/migrations/` hanya berisi 3 file Fase 1–3; Fase 4 tidak menambah apa pun di folder itu. Cek `src/types/database.types.ts` tidak perlu diubah (tidak ada tabel/fungsi baru pada path default).

---

## Task 1: Format export — types + `buildExport` (pure)

**Files:**
- Create: `src/features/import-export/exportFormat.ts`

- [ ] **Step 1: Tulis `exportFormat.ts`**

- Konstanta: `export const FORMAT_ID = "personal-kanban-export"`, `export const FORMAT_VERSION = 1 as const`.
- Tipe: `ExportTask`, `ExportList`, `ExportProject`, `ExportDocV1` persis seperti Spec §8.
- Fungsi murni:

```ts
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type List = Database["public"]["Tables"]["lists"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function buildExport(
  project: Pick<Project, "name" | "description" | "created_at">,
  lists: Pick<List, "id" | "name" | "position">[],
  tasks: Pick<Task, "list_id" | "title" | "description_md" | "due_date" | "position" | "updated_at">[],
  now: string = new Date().toISOString(),
): ExportDocV1
```

- Implementasi: sort `lists` by `position` asc; untuk tiap list, filter `tasks` by `list_id` lalu sort by `position` asc; map ke `ExportTask` (`title`, `description_md`, `due_date`, `position`, `updated_at`); rakit `ExportList` (`name`, `position`, `tasks`); rakit `project` (`name`, `description`, `createdAt: project.created_at`); `exportedAt: now`, `format: FORMAT_ID`, `version: FORMAT_VERSION`.
- **Deterministik** selain argumen `now` (parameter `now` ada khusus supaya self-check bisa memberi nilai tetap).
- Tidak mengimpor React / supabase — murni transform data.

- [ ] **Step 2: Verifikasi** — `pnpm exec tsc -b` exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/import-export/exportFormat.ts
git commit -m "feat(import-export): export format types + pure buildExport()"
```

---

## Task 2: Validasi + normalisasi import (pure) + self-check

**Files:**
- Create: `src/features/import-export/importValidation.ts`
- Create: `src/features/import-export/importValidation.selfcheck.ts`

- [ ] **Step 1: Tulis `importValidation.ts`**

- Konstanta batas: `MAX_LISTS = 100`, `MAX_TASKS = 2000`, `MAX_TASK_DESC = 20000`, `MAX_PROJECT_DESC = 2000`, `MAX_NAME = 200`, `MAX_TITLE = 500`.
- Impor `POSITION_STEP` dari `@/features/board/reorderUtils`.
- `import { FORMAT_ID, FORMAT_VERSION, type ExportDocV1 } from "./exportFormat"`.
- `export type ValidateResult = { ok: true; doc: ExportDocV1 } | { ok: false; errors: string[] }`.
- `export function validateImport(raw: unknown): ValidateResult` — aturan & pesan Bahasa Indonesia persis Spec §6.2. Kumpulkan semua error (kecuali fatal "bukan objek" / "format salah" / "versi" yang boleh early-return). Semua cek tipe defensif (`typeof`, `Array.isArray`, `Number.isInteger`), tidak melempar exception.
- `export interface NormalizedImport { ... }` persis Spec §6.3.
- `export function normalizeImport(doc: ExportDocV1): NormalizedImport` — `trim()` semua string; kosong → `null` untuk description; `position = (i + 1) * POSITION_STEP` dari indeks array (abaikan `position` di file); hanya salin key yang dikenal.
- Semua fungsi murni; tidak impor React / supabase.

- [ ] **Step 2: Tulis `importValidation.selfcheck.ts`** (pola `reorderUtils.selfcheck.ts`: `assertEqual` + `process.exit(1)` on fail, `console.log("PASS: ...")`).

Kasus minimum:

1. Dokumen v1 valid minimal (1 list, 1 task) → `validateImport().ok === true`.
2. `format` salah → `ok === false`, ada error menyebut "export Personal Kanban".
3. `version: 2` → `ok === false`, error menyebut "versi ... lebih baru".
4. `project.name` `""` → `ok === false`, error menyebut "Nama project".
5. Task tanpa `title` → `ok === false`.
6. `due_date: "2026-13-99"` → `ok === false` (format lolos regex tapi `Date.parse` NaN → tetap ditolak) **atau** `"bukan-tanggal"` → `ok === false`.
7. `lists` dengan panjang `MAX_LISTS + 1` → `ok === false`, error batas list.
8. total task `MAX_TASKS + 1` → `ok === false`, error batas task.
9. `normalizeImport` pada dokumen dengan `position` kolaps (`[5, 5, 5]`) → `position` hasil `[1024, 2048, 3072]`.
10. `normalizeImport` men-`trim` `"  Judul  "` → `"Judul"` dan `description_md: ""` → `null`.
11. `raw` bukan objek (`"string"`, `null`, `[]`) → `ok === false`, error "objek JSON".

Akhiri dengan `console.log("All importValidation self-checks passed.")`.

- [ ] **Step 3: Jalankan self-check**

```bash
pnpm dlx tsx src/features/import-export/importValidation.selfcheck.ts
```

Expected: semua `PASS`, exit 0.

- [ ] **Step 4: Verifikasi** — `pnpm exec tsc -b` exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/import-export/importValidation.ts src/features/import-export/importValidation.selfcheck.ts
git commit -m "feat(import-export): pure validateImport/normalizeImport + self-check"
```

---

## Task 3: Export hook + tombol di header board

**Files:**
- Create: `src/features/import-export/useExportProject.ts`
- Modify: `src/features/board/BoardPage.tsx`

- [ ] **Step 1: `useExportProject.ts`**

```ts
export function useExportProject(projectId: string) {
  const queryClient = useQueryClient()
  const exportNow = useCallback(async () => { /* ... */ }, [projectId, queryClient])
  return { exportNow }
}
```

- Ambil data: `queryClient.getQueryData(["project", projectId])`, `["lists", projectId]`, `["tasks", projectId]`. Bila salah satu `undefined`, `await` fetch langsung via `supabase` (query yang sama dengan `useProject`/`useLists`/`useTasks`).
- `doc = buildExport(project, lists, tasks)`; `json = JSON.stringify(doc, null, 2)`.
- `blob = new Blob([json], { type: "application/json" })`; `url = URL.createObjectURL(blob)`.
- `<a>` transient: `href = url`, `download = filename`, `document.body.appendChild`, `.click()`, lalu di `finally`: `a.remove()` + `URL.revokeObjectURL(url)`.
- `filename`: helper `exportFileName(name: string, date = new Date())` → `kanban-<slug>-<YYYY-MM-DD>.json`; `slug` = `name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "project"`. (Boleh taruh helper ini di `exportFormat.ts` atau `useExportProject.ts` — pilih `exportFormat.ts` supaya bisa ikut di-self-check bila mau; opsional.)
- Sukses → `toast.success("File export berhasil dibuat.")`. Gagal → `toast.error("Gagal membuat file export.")`.

- [ ] **Step 2: `BoardPage.tsx`** — di grup kiri header (setelah tombol "Members"):

```tsx
const { exportNow } = useExportProject(projectId)
// ...
<Button variant="outline" onClick={() => void exportNow()}>Export JSON</Button>
```

Tidak ada role-gating (owner & member sama-sama boleh). Tidak mengubah logika DnD / lainnya.

- [ ] **Step 3: Verifikasi**

```bash
pnpm exec tsc -b
pnpm dev   # buka board → "Export JSON" mengunduh kanban-<slug>-<tanggal>.json; isinya sesuai Spec §4
```

- [ ] **Step 4: Commit**

```bash
git add src/features/import-export/useExportProject.ts src/features/board/BoardPage.tsx
git commit -m "feat(import-export): Export JSON button in board header (owner + member)"
```

---

## Task 4: Import hook (`useImportProject`) + rollback-by-delete

**Files:**
- Create: `src/features/import-export/useImportProject.ts`

- [ ] **Step 1: `useImportProject.ts`** — `useMutation`, pola invalidate-on-success (konsisten dgn CRUD non-board).

```ts
export function useImportProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (raw: unknown): Promise<{ projectId: string }> => { /* ... */ },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal meng-import project."),
  })
}
```

`mutationFn`:

1. `const v = validateImport(raw); if (!v.ok) throw new Error(v.errors.join(" "))` (jaring pengaman; dialog sudah validasi lebih dulu).
2. `const norm = normalizeImport(v.doc)`.
3. `getUser()` → `uid`; kalau kosong → `throw new Error("Sesi tidak aktif. Login ulang lalu coba lagi.")`.
4. `insert` `projects` `{ name: norm.project.name, description: norm.project.description, owner_id: uid }` → `.select("id").single()` → `projectId`. (Trigger `on_project_created` menambah baris owner `project_members`.)
5. `try { for (const list of norm.lists) { insert lists {project_id: projectId, name, position} → select("id").single() → listId; if (list.tasks.length) insert tasks batch [{ list_id: listId, project_id: projectId, title, description_md, due_date, position, created_by: uid }, ...] } }`
6. `catch (e) { await supabase.from("projects").delete().eq("id", projectId); throw e }` — `on delete cascade` membersihkan lists/tasks yang sudah masuk.
7. `return { projectId }`.

Catatan: insert list berurutan (perlu `listId` sebelum insert tasks-nya). ≤ 100 list → jumlah request wajar. Tidak perlu optimistic (ini bukan aksi board).

- [ ] **Step 2: Verifikasi** — `pnpm exec tsc -b` exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/import-export/useImportProject.ts
git commit -m "feat(import-export): useImportProject — new project + rollback-by-delete on partial failure"
```

---

## Task 5: `ImportDialog` + tombol di daftar project

**Files:**
- Create: `src/features/import-export/ImportDialog.tsx`
- Modify: `src/features/projects/ProjectListPage.tsx`

- [ ] **Step 1: `ImportDialog.tsx`**

Props: `{ open: boolean; onOpenChange: (o: boolean) => void }`.

- Pakai `@/components/ui/dialog`, `button`. `<input type="file" accept="application/json,.json">` (disembunyikan / dibungkus `<Button>` "Pilih file").
- State: `fileName`, `parseErrors: string[]`, `validDoc: ExportDocV1 | null`, `summary: { lists: number; tasks: number; name: string } | null`.
- `onFileChange`:
  1. `if (file.size > 2 * 1024 * 1024) → parseErrors = ["File terlalu besar (maks 2 MB)."]; return`.
  2. `const text = await file.text()`.
  3. `let parsed; try { parsed = JSON.parse(text) } catch { parseErrors = ["File bukan JSON yang valid."]; return }`.
  4. `const v = validateImport(parsed)`; kalau `!v.ok` → `parseErrors = v.errors; validDoc = null`. Kalau `ok` → `validDoc = v.doc`, hitung `summary` (`v.doc.project.name`, `v.doc.lists.length`, `Σ tasks`).
- Render: nama file terpilih; bila `parseErrors.length` → daftar `<ul>` merah (Bahasa Indonesia); bila `validDoc` → teks ringkasan "Akan membuat project baru \"{name}\" dengan {lists} list dan {tasks} task."
- Footer: tombol **"Import"** `disabled={!validDoc || importMutation.isPending}` → `importMutation.mutate(validDoc, { onSuccess: ({ projectId }) => { onOpenChange(false); toast.success("Project berhasil di-import."); navigate("/projects/" + projectId) } })`.
- Saat dialog ditutup / dibuka ulang: reset semua state.

- [ ] **Step 2: `ProjectListPage.tsx`**

- Di grup kanan header, sebelah "New Project": `<Button variant="outline" onClick={() => setImportOpen(true)}>Import</Button>`.
- `const [importOpen, setImportOpen] = useState(false)` + render `{importOpen && <ImportDialog open={importOpen} onOpenChange={setImportOpen} />}`.
- Tidak mengubah dialog create/edit yang sudah ada.

- [ ] **Step 3: Verifikasi**

```bash
pnpm exec tsc -b
pnpm dev
# 1. Export sebuah project (Task 3), lalu Import file itu → project baru muncul di daftar, board terisi sama.
# 2. Import file JSON acak → pesan error Bahasa Indonesia, tombol Import disabled.
# 3. Import file > 2 MB → ditolak sebelum parse.
```

- [ ] **Step 4: Commit**

```bash
git add src/features/import-export/ImportDialog.tsx src/features/projects/ProjectListPage.tsx
git commit -m "feat(import-export): ImportDialog + Import button on project list"
```

---

## Task 6: QA akhir + verifikasi + dokumentasi

**Files:**
- Modify: `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md`

- [ ] **Step 1: Typecheck** — `pnpm exec tsc -b` → exit 0.

- [ ] **Step 2: Production build** — `pnpm build` → exit 0; `dist/` hanya `index.html` + `assets/` (JS/CSS/woff2); catat ukuran bundle (harus naik hanya ± beberapa KB — tidak ada library baru).

- [ ] **Step 3: Self-check pure functions**

```bash
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts            # regression guard — harus tetap 13/13 PASS
pnpm dlx tsx src/features/import-export/importValidation.selfcheck.ts # baru — semua PASS
```

- [ ] **Step 4: Lint** — `pnpm lint` (oxlint) → tidak ada error baru.

- [ ] **Step 5: E2E manual — pending maintainer (butuh browser + sesi login)**

  1. **Export owner:** buat project P (2–3 list, beberapa task, satu task pakai `# H1` + `<script>alert(1)</script>` di deskripsi, satu task pakai `due_date`). Board → **Export JSON** → file `kanban-<slug>-<tanggal>.json` ter-download. Buka file: `format`/`version`/`exportedAt` ada; lists & tasks lengkap dengan `description_md`, `due_date`, `position`, `updated_at`; tidak ada `id`/`owner_id`/`created_by`.
  2. **Export member:** akun B (member P) buka board P → **Export JSON** berhasil (tidak di-gate).
  3. **Round-trip import:** daftar project → **Import** → pilih file dari langkah 1 → ringkasan benar (nama, jumlah list & task) → **Import** → redirect ke board project **baru**; owner = user yang meng-import; list & task sama & urutan sama; `due_date` & deskripsi utuh; `<script>` **tidak** tereksekusi saat buka task (H1 ter-render).
  4. **Nama sebagai teks:** import file yang `project.name`-nya `"<img src=x onerror=alert(1)>"` → muncul sebagai teks literal di `ProjectCard` / header board, tidak tereksekusi.
  5. **Validasi:** import (a) file `.txt` berisi teks acak → "File bukan JSON yang valid."; (b) `{}` → error `format`; (c) file v1 dengan `version` diubah jadi `2` → error "versi lebih baru"; (d) file dengan satu task `title` dikosongkan → error judul task; (e) file > 2 MB → "File terlalu besar".
  6. **Rollback:** simulasikan gagal di tengah (mis. offline setelah project row terbuat, atau sisipkan `title` sepanjang > kolom bila ada batas) → tidak ada project setengah jadi tertinggal di daftar (project yang terlanjur dibuat terhapus).
  7. **RLS:** akun C (bukan member) tidak melihat project hasil import milik orang lain; `owner_id`/`created_by` pada baris hasil import = id user yang meng-import (cek via Supabase dashboard).

- [ ] **Step 6: Update `docs/PROGRESS.md`** — tambah `## Fase 4 — Import & Export JSON` dengan Plan/Spec path + Task 0–6, tandai selesai per task; `Status:` diisi setelah semua hijau; tandai Step 5 (E2E) sebagai **pending maintainer** bila belum dijalankan.

- [ ] **Step 7: Update `CHANGELOG.md`** — entry baru di atas `[Fase 3]`:

```markdown
## [Fase 4] - <tanggal>
### Added
- Export project ke file JSON dari header board (owner & member) — project + list + task + metadata versi/timestamp, diunduh langsung di browser
- Import file JSON hasil export → membuat project baru milik user yang meng-import, dengan validasi berbahasa Indonesia dan pesan error yang jelas

### Notes
- 100% di client — tidak ada beban tambahan di VPS/Supabase, tidak ada migrasi DB, tidak ada dependency baru
- Import selalu membuat project baru (tidak menimpa / merge). ID lama tidak dipertahankan; owner/created_by = user yang meng-import
- Deskripsi markdown hasil import tetap disanitasi DOMPurify pada render (jalur `renderMarkdown` yang sama); nama project/list/task dirender sebagai teks
- Kegagalan di tengah import melakukan rollback (project yang terlanjur dibuat dihapus, cascade membersihkan list/task)
```

- [ ] **Step 8: Update `docs/MEMORY.md`**

- **Deferred:** ubah `Import/export JSON — Fase 4` menjadi selesai (coret) dengan ringkasan: "Fase 4 — fitur `src/features/import-export/`. Export dari header board (`useExportProject` + `buildExport` murni), Import dari daftar project (`ImportDialog` + `useImportProject`). Format `personal-kanban-export` v1 (nested lists→tasks, tanpa `id`). Validasi/normalisasi murni di `importValidation.ts` (+ `.selfcheck.ts`). Import = project baru selalu; `owner_id`/`created_by` = user yang meng-import; `position` dihitung ulang (`POSITION_STEP`). Atomicity via rollback-by-delete (hapus project → cascade), **tanpa migrasi / RPC**."
- **Conventions:** tambah `src/features/import-export/` ke daftar feature folder; tambah `importValidation.selfcheck.ts` ke daftar pure self-check (di samping `reorderUtils.selfcheck.ts`).
- **Related Docs:** tambah spec + plan Fase 4.
- (Jangan sentuh butir deployment/VPS.)

- [ ] **Step 9: Commit final**

```bash
git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
git commit -m "docs: mark Fase 4 (import/export JSON) complete; update changelog and memory"
```

---

## Self-Review Notes

- **Spec coverage:** §4 format file → Task 1. §5 export (UI/build/download) → Task 1 + Task 3. §6.2 validasi → Task 2. §6.3 normalisasi → Task 2. §6.4 insert + rollback → Task 4. §6.1 dialog import → Task 5. §7 keamanan (batas ukuran, JSON.parse aman, teks vs HTML, `renderMarkdown`) → Task 4 + Task 5 + Task 6 Step 5. §8 lokasi file → semua task. §10 kriteria sukses → Task 6.
- **Tanpa perubahan DB:** tidak ada file baru di `supabase/migrations/`; `src/types/database.types.ts` tidak diubah. Opsi RPC `import_project` sengaja tidak diambil (Spec §7.4 / §11 pertanyaan 2) — jika maintainer memintanya, itu task migrasi terpisah sebelum Task 4.
- **Tanpa dependency baru:** `package.json` / `pnpm-lock.yaml` tidak berubah.
- **Regression guard:** `reorderUtils.selfcheck.ts` tetap dijalankan di Task 6 Step 3; drag&drop / fractional position / markdown editor tidak disentuh. Fase 4 hanya menambah tombol di header `BoardPage` dan `ProjectListPage`.
- **Keamanan konten:** markdown import lewat `renderMarkdown` (marked + DOMPurify) yang sudah ada — tidak ada jalur render HTML baru. Nama project/list/task hanya lewat JSX text. Batas ukuran file (2 MB) + batas jumlah (100 list / 2.000 task) + batas panjang string membatasi payload jahil. Tidak ada path filesystem yang disusun aplikasi.
- **Integritas RLS:** `owner_id`/`created_by` selalu `auth.uid()`; `project_id`/`list_id` selalu id yang baru dibuat; RLS Fase 3 tetap penjaga terakhir. Trigger `on_project_created` membuat langkah insert lists/tasks lolos `is_project_member` tanpa aksi tambahan.
- **Urutan aman:** util murni + self-check (Task 1–2) sebelum hook yang memakainya; export (Task 3) independen dari import; import hook (Task 4) sebelum dialognya (Task 5); QA + docs (Task 6) terakhir. Tiap task punya commit sendiri.
- **Batasan PRD dijaga:** 100% client-side (PRD §4.5) — export tak ada write, import hanya insert yang user memang berhak; VPS tak tersentuh; free tier aman (tak ada tabel/proses/fungsi baru). Google OAuth only (tak ada perubahan auth). Bundle tetap kecil (tanpa library baru).
- **Pertanyaan terbuka (Spec §11):** merge ke project existing (1), RPC atomik (2), JSON generik (3), Export di ProjectCard (4), simpan id lama (5), nilai batas (6). Asumsi kerja A1–A8 dipakai bila belum dijawab; keputusan bisa berubah tanpa membongkar struktur task.

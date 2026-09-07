# Personal Kanban — Fase 4 (Import & Export JSON) Design Spec

> Sumber: `docs/PRD-Personal-Kanban-App.md` §4.5 (Import & Export JSON), §5 (out of scope v1), §7.3 (free tier), §9 Fase 4; daftar "Deferred" di `docs/MEMORY.md`.
> Status: Draft — menunggu review maintainer (ada pertanyaan terbuka di §11).
> Prasyarat: Fase 3 sudah live (https://kanban.cundus.my.id) — `project_members` + RLS berbasis keanggotaan, fungsi `SECURITY DEFINER` anti-rekursi, trigger `on_project_created`, DOMPurify (`renderMarkdown`) sudah terpasang.

## 1. Ringkasan

Fase 4 menambah dua alur, keduanya **100% di client** sesuai PRD §4.5 ("proses 100% di client, tidak membebani VPS/Supabase"):

- **Export** — dari header board, owner **atau** member men-generate satu file `.json` berisi struktur project (project + lists + tasks + metadata versi format & timestamp) dan mengunduhnya lewat `Blob` di browser.
- **Import** — dari daftar project, user mana pun meng-upload file `.json` hasil export (format versi 1), file divalidasi & dinormalisasi di client, lalu di-insert ke Supabase sebagai **project baru** yang dimiliki user yang meng-import.

Tidak ada perubahan skema database. Tidak ada dependency baru. Tidak ada perubahan RLS. Alur import memanfaatkan policy Fase 3 apa adanya: `projects` INSERT (`owner_id = auth.uid()`) → trigger `on_project_created` menambah baris owner `accepted` di `project_members` → `lists`/`tasks` INSERT lolos `is_project_member(project_id)` untuk user yang sama, dalam transaksi/rangkaian request yang sama.

Di luar scope Fase 4: merge import ke project yang sudah ada, import format non-native (JSON generik), export/import banyak project sekaligus, export CSV/Markdown, penjadwalan backup otomatis. (Kandidat fase berikutnya / lihat §11.)

## 2. Perubahan Tech Stack

| Area | Fase 3 | Fase 4 |
|---|---|---|
| Dependency | `dompurify` ditambahkan | **tidak ada tambahan** |
| Fitur frontend | `auth/`, `projects/`, `board/`, `members/` | + `import-export/` |
| DB (tabel / fungsi / RLS / migrasi) | `project_members` + 5 fungsi + RLS keanggotaan | **tidak ada perubahan** (RPC `import_project` hanya opsi terbuka — §7.4 & §11) |
| Util murni + self-check | `reorderUtils.ts` (+ `.selfcheck.ts`) | + `importValidation.ts` (+ `.selfcheck.ts`) |

Perkiraan bundle: bertambah hanya ± ukuran kode fitur (beberapa KB) — tidak ada library baru. `JSON.parse`/`JSON.stringify` dan `Blob`/`URL.createObjectURL` adalah API browser bawaan.

## 3. Skema & RLS Baseline yang Dipakai (hasil eksplorasi)

Dari `supabase/migrations/20260906000000_init_schema.sql` + `20260906010000_fractional_positions.sql` + `20260906020000_project_members_rls.sql`:

| Tabel | Kolom | RLS efektif (sesudah Fase 3) |
|---|---|---|
| `projects` | `id` uuid PK default `gen_random_uuid()`, `name` text not null, `description` text null, `owner_id` uuid not null → `auth.users`, `created_at` timestamptz default `now()` | SELECT `owner_id = auth.uid() OR is_project_member(id)`; INSERT `owner_id = auth.uid()`; UPDATE/DELETE `owner_id = auth.uid()` |
| `lists` | `id` uuid PK default `gen_random_uuid()`, `project_id` uuid not null → `projects` `on delete cascade`, `name` text not null, `position` **double precision** (fractional index) | SELECT/INSERT/UPDATE/DELETE `is_project_member(project_id)` |
| `tasks` | `id` uuid PK default `gen_random_uuid()`, `list_id` uuid not null → `lists` `on delete cascade`, `project_id` uuid not null → `projects` `on delete cascade`, `title` text not null, `description_md` text null, `due_date` **date** null, `position` **double precision**, `created_by` uuid not null → `auth.users`, `updated_at` timestamptz default `now()` | SELECT/INSERT/UPDATE/DELETE `is_project_member(project_id)` |

Trigger `public.handle_new_project()` (`SECURITY DEFINER`) pada `after insert on projects` menambah baris `project_members(project_id, user_id=owner_id, role='owner', status='accepted')`. **Konsekuensi penting untuk import:** begitu `projects` row dibuat oleh user X, X otomatis anggota `accepted` → `insert` `lists`/`tasks` untuk `project_id` itu langsung lolos RLS tanpa langkah tambahan.

### Catatan kolom yang relevan untuk format file

- `tasks` **tidak punya** kolom `created_at` — hanya `updated_at` + `created_by`. Format export menyimpan `updated_at` per task (informasional); tidak ada `created_at` task untuk disimpan.
- `position` kini `double precision`. Nilai `position` dari file **tidak dipercaya** saat import — dihitung ulang deterministik (lihat §6.3) memakai `POSITION_STEP` dari `src/features/board/reorderUtils.ts`.
- `due_date` bertipe `date` → di JS berupa string `YYYY-MM-DD` atau `null`.

## 4. Format File Export — `personal-kanban-export` v1

Satu objek JSON, **nested** (lists memuat tasks-nya) supaya validasi sederhana dan tidak ada referensi menggantung:

```jsonc
{
  "format": "personal-kanban-export",   // penanda tetap; ditolak kalau beda
  "version": 1,                          // integer; import v1 hanya menerima 1
  "exportedAt": "2026-09-07T10:15:00.000Z", // ISO 8601 UTC, informasional
  "project": {
    "name": "Rencana Rilis",            // dikonsumsi saat import
    "description": "Q4 2026",           // string | null — dikonsumsi
    "createdAt": "2026-09-01T02:00:00Z" // informasional; DIABAIKAN saat import
  },
  "lists": [
    {
      "name": "To Do",                  // dikonsumsi
      "position": 1024,                 // informasional; DIABAIKAN saat import (dihitung ulang)
      "tasks": [
        {
          "title": "Tulis changelog",   // dikonsumsi (wajib, non-kosong)
          "description_md": "## Draft\n- poin", // string | null — dikonsumsi
          "due_date": "2026-10-01",     // "YYYY-MM-DD" | null — dikonsumsi
          "position": 1024,             // informasional; DIABAIKAN (dihitung ulang)
          "updated_at": "2026-09-05T09:00:00Z" // informasional; DIABAIKAN
        }
      ]
    }
  ]
}
```

**Field yang dikonsumsi saat import:** `format`, `version`, `project.name`, `project.description`, `lists[].name`, `lists[].tasks[].title`, `lists[].tasks[].description_md`, `lists[].tasks[].due_date`. Urutan array `lists` dan `tasks` = urutan tampilan; `position` dihitung ulang dari urutan itu.

**Field informasional (ditulis saat export, diabaikan saat import):** `exportedAt`, `project.createdAt`, `lists[].position`, `lists[].tasks[].position`, `lists[].tasks[].updated_at`.

**Tidak disertakan sama sekali:** semua `id` (`project.id`, `list.id`, `task.id`), `owner_id`, `created_by`, `list_id`, `project_id`. ID lintas-database tidak bermakna dan menyertakannya justru mengundang logika merge yang tidak diinginkan di v1. (Pertanyaan terbuka §11: perlu menyertakan id lama sebagai informasional?)

Konstanta di kode: `FORMAT_ID = "personal-kanban-export"`, `FORMAT_VERSION = 1` (di `exportFormat.ts`).

## 5. Export — Desain

### 5.1 Pemicu UI

Tombol **"Export JSON"** di header `BoardPage`, bersebelahan dengan tombol **"Members"** (grup kiri header). Alasan menaruh di board, bukan di `ProjectCard`:

- Board sudah memuat `useLists(projectId)` + `useTasks(projectId)` ke cache TanStack Query → export tinggal membaca cache, tanpa query tambahan.
- `ProjectCard` tetap ringkas (Open / Edit / Delete / badge role).
- Konsisten dengan pola Fase 3 (aksi per-project lain — Members — juga di header board).

Tombol tampil untuk **owner dan member** (keduanya bisa membaca board → keduanya boleh export). Tidak ada role-gating.

(Pertanyaan terbuka §11: tambahkan juga entry "Export" di `ProjectCard` untuk export tanpa membuka board?)

### 5.2 Pengumpulan data & pembangunan dokumen

Fungsi murni `buildExport(project, lists, tasks): ExportDocV1` di `exportFormat.ts`:

1. Input: `project` (dari `useProject`), `lists` (dari `useLists`, sudah terurut `position` asc), `tasks` (dari `useTasks`, project-scoped).
2. Kelompokkan tasks per `list_id`, urutkan tiap grup by `position` asc.
3. Susun objek sesuai §4: `project.name/description`, `project.createdAt = project.created_at`, tiap list `{ name, position, tasks: [...] }`, tiap task `{ title, description_md, due_date, position, updated_at }`.
4. `exportedAt = new Date().toISOString()`, `format = FORMAT_ID`, `version = FORMAT_VERSION`.
5. Deterministik selain `exportedAt` (memudahkan self-check: bisa membandingkan setelah menghapus field itu).

### 5.3 Pengunduhan (client-side)

Hook `useExportProject(projectId)` mengembalikan `exportNow()`:

1. Ambil `project`/`lists`/`tasks` dari cache query (`queryClient.getQueryData`), fallback fetch langsung bila belum ada.
2. `doc = buildExport(...)`; `json = JSON.stringify(doc, null, 2)`.
3. `blob = new Blob([json], { type: "application/json" })`; `url = URL.createObjectURL(blob)`.
4. Buat `<a>` sementara: `a.href = url`, `a.download = <filename>`, `a.click()`, lalu `a.remove()` + `URL.revokeObjectURL(url)` di `finally`.
5. `toast.success("File export berhasil dibuat.")`.

**Nama file:** `kanban-<slug>-<YYYY-MM-DD>.json`, `slug` = `project.name` di-`normalize("NFKD")`, buang non-`[a-z0-9]`, spasi→`-`, lowercase, dipangkas ≤ 40 char; fallback `"project"` bila kosong. Contoh: `kanban-rencana-rilis-2026-09-07.json`.

**Aksesibilitas:** pemicu adalah `<button>` biasa (fokusable, ada label teks). Elemen `<a>` transient tidak masuk tab order dan langsung dihapus. Umpan balik keberhasilan lewat `toast` (sonner sudah ter-mount di `App.tsx`).

**Ukuran:** project skala pribadi = beberapa KB s/d puluhan KB. Tidak ada streaming/chunking — `JSON.stringify` sekali jalan cukup. Free tier tidak tersentuh (tidak ada write, hanya read yang sudah terjadi untuk render board).

## 6. Import — Desain

### 6.1 Pemicu UI

Tombol **"Import"** di header `ProjectListPage`, di grup kanan sebelah **"New Project"**. Membuka `ImportDialog`:

- `<input type="file" accept="application/json,.json">` (dibungkus tombol berlabel jelas).
- Setelah file dipilih: baca teks, `JSON.parse` di `try/catch`, jalankan `validateImport`.
- Bila **invalid**: tampilkan daftar pesan error (Bahasa Indonesia) di dalam dialog; tombol "Import" disabled.
- Bila **valid**: tampilkan ringkasan ("Akan membuat project baru \"<nama>\" dengan N list dan M task") + tombol **"Import"**.
- Klik "Import" → `useImportProject().mutate(doc)` → sukses: tutup dialog, `toast.success`, navigate ke `/projects/<id baru>`; gagal: `toast.error` + dialog tetap terbuka.

Tersedia untuk **semua user terautentikasi** — import = membuat project baru, dan siapa pun boleh membuat project (jadi owner-nya).

### 6.2 Validasi — `validateImport(raw: unknown)`

Fungsi murni di `importValidation.ts`. Return:

```ts
type ValidateResult =
  | { ok: true; doc: ExportDocV1 }
  | { ok: false; errors: string[] }
```

Aturan (semua pesan Bahasa Indonesia, dikumpulkan — bukan gagal di error pertama, kecuali yang fatal seperti "bukan objek"):

| Cek | Pesan contoh saat gagal |
|---|---|
| `raw` adalah objek non-array | "File tidak berisi objek JSON yang valid." |
| `format === "personal-kanban-export"` | "File ini bukan hasil export Personal Kanban." |
| `version` integer; `=== 1` | `> 1`: "File dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi lalu coba lagi." / lainnya: "Versi format file tidak didukung." |
| `project` objek; `project.name` string non-kosong, ≤ 200 char | "Nama project wajib ada dan tidak boleh kosong." |
| `project.description` `null`/`undefined`/string ≤ 2.000 char | "Deskripsi project terlalu panjang (maks 2.000 karakter)." |
| `lists` array, panjang ≤ **100** | "Jumlah list melebihi batas (maks 100)." |
| tiap `list.name` string non-kosong ≤ 200 | "List ke-{i} tidak punya nama yang valid." |
| tiap `list.tasks` array; **total task ≤ 2.000** | "Jumlah task melebihi batas (maks 2.000)." |
| tiap `task.title` string non-kosong ≤ 500 | "Task ke-{j} di list \"{name}\" tidak punya judul yang valid." |
| tiap `task.description_md` `null`/`undefined`/string ≤ **20.000** | "Deskripsi salah satu task terlalu panjang (maks 20.000 karakter)." |
| tiap `task.due_date` `null`/`undefined`/`/^\d{4}-\d{2}-\d{2}$/` dan `Number.isFinite(Date.parse(v))` | "Tanggal jatuh tempo salah satu task tidak valid (format YYYY-MM-DD)." |

Batas (100 list / 2.000 task / 20.000 char deskripsi / 2.000 char deskripsi project) = jauh di atas kebutuhan pribadi tapi membatasi kerja render & jumlah baris DB dari file jahil. Nilai final bisa disesuaikan maintainer.

### 6.3 Normalisasi — `normalizeImport(doc: ExportDocV1)`

Fungsi murni, dijalankan setelah validasi lolos. Menghasilkan struktur siap-insert yang **tidak bergantung pada nilai dari file untuk hal sensitif**:

```ts
interface NormalizedImport {
  project: { name: string; description: string | null }
  lists: Array<{
    name: string
    position: number                 // (index + 1) * POSITION_STEP
    tasks: Array<{
      title: string
      description_md: string | null
      due_date: string | null
      position: number               // (index + 1) * POSITION_STEP
    }>
  }>
}
```

- `trim()` semua string; `name`/`title` yang jadi kosong setelah trim seharusnya sudah ditolak di validasi.
- `description`/`description_md` kosong → `null`.
- `position` **dihitung ulang** dari indeks array (`(i + 1) * POSITION_STEP`, `POSITION_STEP = 1024` diimpor dari `reorderUtils.ts`) — nilai `position` di file diabaikan total. Ini menetralkan file dengan `position` kolaps/duplikat/negatif/`NaN`.
- Field informasional (`updated_at`, `createdAt`, `exportedAt`) dibuang.
- Field asing yang tidak dikenal dibuang (hanya key di atas yang disalin).

### 6.4 Eksekusi insert + strategi konflik

**Selalu project BARU. Tidak ada merge ke project existing di v1.** Alasan:

1. **Kesederhanaan** — tidak perlu UI pemilihan project/list target, tidak perlu rekonsiliasi `position`, tidak perlu memutuskan duplikat.
2. **Keamanan RLS** — user yang meng-import dijamin `owner` project baru (via `owner_id = auth.uid()` + trigger). Merge ke project lain menuntut cek keanggotaan + membuka permukaan untuk menulis ke project yang bukan miliknya.
3. **ID baru** — semua `id` di-generate DB (`gen_random_uuid()`); client tidak pernah mengirim `id`. Tidak ada tabrakan PK, tidak ada kebocoran referensi antar-project.

Hook `useImportProject()` (`useMutation`, pola invalidate-on-success seperti CRUD non-board):

1. `validateImport` → kalau `!ok`, `throw` dengan pesan gabungan (dialog sudah memvalidasi lebih dulu; ini jaring pengaman).
2. `normalizeImport`.
3. `getUser()` → `uid`. Kalau tidak ada → `throw new Error("Sesi tidak aktif. Login ulang lalu coba lagi.")`.
4. `insert` `projects` `{ name, description, owner_id: uid }` → `.select().single()` → `projectId`. (Trigger menambah baris owner `project_members`.)
5. Untuk tiap list (berurutan, ≤ 100): `insert` `lists` `{ project_id: projectId, name, position }` → `.select("id").single()` → `listId`. Bila list punya tasks: satu `insert` batch `tasks` `[{ list_id: listId, project_id: projectId, title, description_md, due_date, position, created_by: uid }, ...]`.
6. Bila **langkah 5 mana pun gagal**: `await supabase.from("projects").delete().eq("id", projectId)` — `on delete cascade` menghapus semua `lists`/`tasks` yang sudah masuk → DB kembali bersih. Lalu `throw` error asli.
7. `onSuccess`: `invalidateQueries(["projects"])`; komponen melakukan `navigate("/projects/" + projectId)` + `toast.success("Project berhasil di-import.")`.
8. `onError`: `toast.error(<pesan>)`.

**Atomicity — keputusan:** rollback manual-by-delete (langkah 6), **tanpa migrasi**. Jendela partial-write hanya 2–N request berturut-turut; kegagalan di tengah selalu diikuti `delete` project sehingga tidak meninggalkan project setengah jadi. Cukup untuk skala pribadi & hemat (tidak menambah fungsi DB untuk dirawat). Lihat §7.4 untuk alternatif RPC yang benar-benar atomik (opsi terbuka, bukan rekomendasi default).

### 6.5 Format yang diterima

Hanya file dengan `format === "personal-kanban-export"` **dan** `version === 1`. JSON generik (mis. hasil export tool lain) **ditolak** dengan pesan ramah. (Pertanyaan terbuka §11: menerima bentuk minimal generik `{ name, lists: [{ name, tasks: [{ title }] }] }`?)

## 7. Keamanan

### 7.1 Parsing file

- Batas ukuran **sebelum** baca: bila `file.size > 2 * 1024 * 1024` (2 MB) → tolak ("File terlalu besar (maks 2 MB)."). Project pribadi jauh di bawah ini; batas mencegah UI freeze / payload abusif.
- `JSON.parse` dibungkus `try/catch` → pesan "File bukan JSON yang valid." Tidak ada reviver function, tidak ada `eval`.
- Batas jumlah (list/task) & panjang string di `validateImport` → kerja render dan jumlah baris DB terbatas.

### 7.2 XSS / injeksi konten

- **Nama project, nama list, judul task** dirender sebagai teks biasa lewat JSX (`{project.name}`, dst.) — React meng-escape secara default. Dikonfirmasi: `ProjectCard`, `BoardPage` header, `ListColumn`, `TaskCard` tidak memakai `dangerouslySetInnerHTML` untuk field ini. **Tidak boleh** ada perubahan yang merender field ini sebagai HTML.
- **`description_md`** dirender lewat `renderMarkdown()` yang sudah ada (`marked` → `DOMPurify.sanitize`) di `TaskDialog` (view) dan `MarkdownEditor` (preview). Markdown hasil import melewati **jalur render yang sama persis** dengan konten yang ditulis member → payload seperti `<script>` / `<img onerror>` tersaring DOMPurify. Tidak ada jalur render baru yang dibuat di Fase 4.

### 7.3 Path traversal / filesystem

- Export: `a.download` diisi nama file yang sudah di-slug ke `[a-z0-9-]` + tanggal — tidak ada `/`, `..`, atau karakter path. Browser juga mengabaikan komponen path di `download`.
- Import: hanya lewat `<input type="file">` (file picker OS) — aplikasi tidak pernah menyusun path filesystem.

### 7.4 Integritas & otorisasi insert

- `owner_id` / `created_by` **selalu** `auth.uid()` dari sesi — tidak pernah dari file.
- `project_id` / `list_id` selalu id yang baru dibuat di request itu — tidak pernah dari file.
- RLS Fase 3 tetap penjaga terakhir: kalau (karena bug) client mencoba insert `lists`/`tasks` dengan `project_id` milik orang lain, `is_project_member` menolaknya.
- `due_date` sudah divalidasi `YYYY-MM-DD` + `Date.parse` finite sebelum dikirim; supabase-js mem-parametrisasi query (tidak ada string-concat SQL).

**Opsi terbuka — RPC atomik (bukan default):** `create function import_project(payload jsonb) returns uuid language plpgsql security definer` yang membuat project + lists + tasks dalam satu transaksi, `owner_id`/`created_by` di-set ke `auth.uid()` di dalam fungsi, dengan validasi ukuran ulang di SQL. Untung: benar-benar atomik, satu round-trip (lebih hemat bila list/task banyak). Rugi: butuh migrasi baru + fungsi untuk dirawat, dan menambah permukaan `SECURITY DEFINER`. Rekomendasi: **tunda**; rollback-by-delete (§6.4) memadai untuk skala ini. Diangkat sebagai pertanyaan §11.

## 8. Type & Lokasi File

Folder baru `src/features/import-export/`:

| File | Isi |
|---|---|
| `exportFormat.ts` | `FORMAT_ID`, `FORMAT_VERSION`; tipe `ExportDocV1`, `ExportProject`, `ExportList`, `ExportTask`; fungsi murni `buildExport(project, lists, tasks): ExportDocV1` |
| `importValidation.ts` | `validateImport(raw): ValidateResult`; `normalizeImport(doc): NormalizedImport`; konstanta batas (`MAX_LISTS`, `MAX_TASKS`, dst.). Impor `POSITION_STEP` dari `@/features/board/reorderUtils` |
| `importValidation.selfcheck.ts` | Self-check assert-based (pola `reorderUtils.selfcheck.ts`), dijalankan `pnpm dlx tsx src/features/import-export/importValidation.selfcheck.ts` |
| `useExportProject.ts` | Hook: kumpulkan data dari cache/fetch, `buildExport`, unduh via Blob, `toast` |
| `useImportProject.ts` | `useMutation`: validate → normalize → insert berurutan + rollback-by-delete; invalidate `["projects"]` |
| `ImportDialog.tsx` | File picker + tampilan error validasi (Bahasa Indonesia) + ringkasan + tombol Import |

Perubahan file lama (minimal):

- `src/features/board/BoardPage.tsx` — tambah tombol "Export JSON" di header (panggil `useExportProject`).
- `src/features/projects/ProjectListPage.tsx` — tambah tombol "Import" + render `ImportDialog`.
- `src/types/database.types.ts` — **tidak berubah** (tidak ada tabel/fungsi baru pada path default).
- `docs/PROGRESS.md`, `CHANGELOG.md`, `docs/MEMORY.md` — di task QA terakhir.

`ExportDocV1` (ringkas):

```ts
export const FORMAT_ID = "personal-kanban-export"
export const FORMAT_VERSION = 1 as const

export interface ExportTask {
  title: string
  description_md: string | null
  due_date: string | null
  position: number
  updated_at: string
}
export interface ExportList {
  name: string
  position: number
  tasks: ExportTask[]
}
export interface ExportProject {
  name: string
  description: string | null
  createdAt: string
}
export interface ExportDocV1 {
  format: typeof FORMAT_ID
  version: typeof FORMAT_VERSION
  exportedAt: string
  project: ExportProject
  lists: ExportList[]
}
```

## 9. Alur End-to-End (ringkas)

**Export:** board → "Export JSON" → `useExportProject.exportNow()` → baca cache lists+tasks → `buildExport` → `JSON.stringify` → Blob download `kanban-<slug>-<tanggal>.json` → toast.

**Import:** daftar project → "Import" → pilih file → cek ukuran → `JSON.parse` → `validateImport` → (invalid: tampilkan error, stop) → ringkasan → "Import" → `useImportProject`: insert project (owner = user) → trigger buat baris owner → loop insert lists → batch insert tasks per list → (error di tengah: delete project, cascade bersih, toast error) → sukses: invalidate `["projects"]`, navigate ke board baru, toast.

## 10. Kriteria Sukses Fase 4

- Owner **dan** member bisa meng-export board jadi satu file `.json` yang ter-download; isinya sesuai §4 (metadata versi + timestamp, project, lists, tasks dengan title/description_md/due_date + field informasional position/updated_at).
- File hasil export bisa di-import kembali → menghasilkan **project baru** milik user yang meng-import, dengan list & task yang sama, urutan sama, `due_date` & deskripsi utuh.
- Import menolak dengan pesan Bahasa Indonesia yang jelas untuk: bukan JSON, `format` salah, `version` > 1, `project.name` kosong, task tanpa judul, file > 2 MB, jumlah list/task di atas batas.
- ID lama tidak pernah dipertahankan; `owner_id`/`created_by` = user yang meng-import; tidak ada kebocoran ke project lain (RLS).
- Kegagalan di tengah import tidak meninggalkan project setengah jadi (rollback-by-delete terverifikasi).
- Markdown hasil import yang mengandung `<script>`/`<img onerror>` tidak tereksekusi (lewat `renderMarkdown`/DOMPurify).
- Nama project/list/task hasil import dirender sebagai teks (tidak ada HTML injection).
- Tidak ada migrasi DB, tidak ada dependency baru, tidak ada perubahan RLS.
- `pnpm exec tsc -b` 0 error; `pnpm build` output static-only; `reorderUtils.selfcheck.ts` **dan** `importValidation.selfcheck.ts` semua PASS.
- `PROGRESS.md` / `CHANGELOG.md` / `MEMORY.md` terupdate.

## 11. Pertanyaan Terbuka untuk Maintainer

1. **Merge ke project existing** — v1 selalu membuat project baru. Perlukah opsi "import ke project yang sudah saya miliki" (menambahkan lists/tasks ke project terpilih)? Menambah UI pemilihan + rekonsiliasi posisi + keputusan duplikat. Rekomendasi: tunda ke fase berikutnya.
2. **Atomicity via RPC** — pakai `import_project(jsonb)` `SECURITY DEFINER` (benar-benar atomik, 1 round-trip, tapi butuh migrasi + fungsi dirawat) atau cukup rollback-by-delete di client (rekomendasi default, tanpa migrasi)?
3. **JSON generik** — selain file native v1, terima bentuk minimal `{ name, lists: [{ name, tasks: [{ title }] }] }` dari sumber lain? Rekomendasi: tidak untuk v1.
4. **Entry Export di `ProjectCard`** — cukup di header board, atau tambahkan juga tombol/menu "Export" di kartu project pada daftar (export tanpa membuka board, perlu fetch lists+tasks di sana)? Rekomendasi: hanya header board untuk v1.
5. **Menyertakan id lama** — format v1 membuang semua `id`. Perlu menyimpannya sebagai field informasional (untuk audit/trace) meski diabaikan saat import? Rekomendasi: tidak — mengurangi godaan logika merge.
6. **Nilai batas** — 100 list / 2.000 task / 20.000 char deskripsi / 2 MB file. Cocok, atau perlu disesuaikan?

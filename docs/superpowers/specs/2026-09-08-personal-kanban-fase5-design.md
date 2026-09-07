# Fase 5 — Task Actions, Task Detail Upgrade & Arsip

> Sumber: brainstorming 2026-09-08 bersama maintainer.
> Status: desain disetujui, siap dikonversi ke implementation plan.
> Prasyarat: Fase 1–4 sudah ship (board dnd-kit, markdown, members/RLS, import/export JSON).

---

## 1. Ringkasan

Fase 5 melengkapi board dengan tiga hal yang selama ini hilang:

1. **Menu aksi pada task card** — right-click (desktop) atau tombol `...` (mobile) memunculkan menu: Rename, Duplicate, Move to list, Copy link, Archive, Delete.
2. **Menu aksi pada header list** — menu ramping: Rename, Add task to top, Delete list. Tombol Trash lama dicabut.
3. **Upgrade task detail dialog** — dialog lebar dua kolom, autosave per-field, metadata footer, deep-link `?task=<id>`, dan menu aksi yang sama di header dialog.

Fitur Archive membutuhkan satu kolom baru (`tasks.archived_at`) dan satu dialog "Archived" per project untuk Restore / Delete permanen.

**Di luar scope Fase 5** (masuk Fase 6, siklus terpisah): labels, assignee, checklist, ornamen visual task card.

---

## 2. Perubahan Tech Stack

| Item | Status sekarang | Perubahan Fase 5 |
| --- | --- | --- |
| `@base-ui/react` | `^1.8.0`, sudah dipakai untuk Menu & Dialog | Tidak ada upgrade. Mulai memakai subpath `@base-ui/react/context-menu` dan part `Menu.SubmenuRoot` / `Menu.SubmenuTrigger` yang sudah tersedia di versi ini |
| `react-router-dom` | `7.x`, board pakai `useParams` + `useNavigate` | Mulai memakai `useSearchParams` untuk deep-link `?task=<id>` |
| Supabase JS | terpasang | Tidak berubah |
| Dependensi baru | — | **Nol.** Semua kebutuhan Fase 5 dipenuhi paket yang sudah ada |

---

## 3. Skema & RLS Baseline Hasil Eksplorasi

Tabel `tasks` saat ini (`src/types/database.types.ts`, ditulis tangan):

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| `id` | uuid | PK |
| `list_id` | uuid | FK → `lists.id` |
| `project_id` | uuid | FK → `projects.id`, dipakai RLS |
| `title` | text | |
| `description_md` | text \| null | markdown mentah |
| `due_date` | date \| null | |
| `position` | double precision | fractional positioning |
| `created_by` | uuid, not null | FK → `auth.users(id) on delete cascade` |
| `updated_at` | timestamptz | di-set manual oleh `useUpdateTask` |

RLS `tasks` sudah ada dan berbasis fungsi `is_project_member(project_id)`. **Fase 5 tidak mengubah satupun policy** — kolom baru ikut policy yang sama karena granularitas RLS di tabel ini adalah baris, bukan kolom.

### 3.1 Migrasi Baru

File: `supabase/migrations/20260908000000_task_archive.sql`

```sql
alter table public.tasks
  add column archived_at timestamptz;

create index tasks_active_by_list_idx
  on public.tasks (list_id, position)
  where archived_at is null;
```

Alasan index parsial: seluruh query board memfilter `archived_at is null` lalu mengurutkan `position` per `list_id`. Task terarsip menumpuk seiring waktu tetapi tidak pernah masuk hot path board.

Tidak ada backfill — `NULL` berarti aktif, dan seluruh baris lama otomatis aktif.

---

## 4. Format Data

### 4.1 Kontrak `archived_at`

- `null` → task aktif, muncul di board.
- timestamptz → task terarsip, hanya muncul di dialog Archived.

Archive bukan soft-delete. Delete permanen tetap `DELETE` baris seperti sekarang.

### 4.2 Deep-link

```
/project/:projectId?task=<uuid>
```

- Param `task` adalah satu-satunya sumber kebenaran untuk dialog mana yang terbuka. State lokal `openTaskId` di `BoardPage` dihapus.
- Menutup dialog menghapus param (bukan menambah entri history baru — pakai `{ replace: true }` supaya tombol Back tidak jadi tumpukan buka-tutup dialog).
- Param `task` yang tidak cocok dengan task manapun (sudah dihapus, terarsip, atau milik project lain): tampilkan toast `"Task tidak ditemukan."` lalu bersihkan param. Tidak boleh render dialog kosong.

### 4.3 Judul hasil duplicate

`"<judul asal> (copy)"` — tanpa penomoran bertingkat. Duplikat dari duplikat menghasilkan `"Judul (copy) (copy)"`. Ini disengaja: penomoran unik butuh pembacaan seluruh list dan tidak sepadan.

---

## 5. Desain: Menu Aksi Task Card

### 5.1 Pemicu

Dua pemicu, satu isi menu:

- **Desktop** — right-click di mana saja pada `<article>` task card. `ContextMenu.Trigger` dari `@base-ui/react/context-menu` membungkus card.
- **Mobile** — tombol `...` yang **selalu terlihat** (bukan hover) di pojok kanan atas card, disembunyikan di `sm:` ke atas dengan `sm:hidden`.

Alasan tombol selalu terlihat di mobile: perangkat sentuh tidak punya hover, jadi pola `group-hover` yang dipakai tombol Trash di `ListColumn` tidak bisa dipakai di sini.

### 5.2 Risiko: long-press vs TouchSensor

`ContextMenu` Base UI aktif via right-click **atau long press**. `BoardPage` mengonfigurasi `TouchSensor` dengan `delay: 200, tolerance: 8`. Keduanya bersaing untuk gestur tekan-tahan yang sama.

**Keputusan:** matikan long-press bawaan ContextMenu jika Base UI menyediakan opsinya; jika tidak, biarkan dnd-kit menang (drag lebih penting daripada menu di mobile karena mobile sudah punya tombol `...`).

**Wajib QA manual** di viewport 375 dengan perangkat sentuh nyata:
- tekan-tahan card → harus mulai drag, **bukan** membuka menu;
- tap tombol `...` → membuka menu;
- tap badan card → membuka task dialog.

### 5.3 Isi menu

| Item | Aksi |
| --- | --- |
| Rename | Buka task dialog dengan fokus otomatis di field title. Tidak ada inline edit di card |
| Duplicate | `useDuplicateTask` — lihat §5.5 |
| Move to list ▸ | Submenu berisi seluruh list project. List saat ini ditandai disabled |
| Copy link | Salin URL absolut `?task=<id>` ke clipboard |
| Archive | Set `archived_at = now()` |
| Delete | Destructive. Buka `ConfirmDialog` yang sudah ada sebelum menghapus |

Separator sebelum Archive/Delete untuk memisahkan aksi merusak dari aksi biasa.

### 5.4 stopPropagation

Card punya `onClick` yang membuka dialog. Tombol `...` harus memanggil `event.stopPropagation()` supaya menekannya tidak sekaligus membuka dialog. Item menu dirender di portal jadi tidak terkena masalah ini.

### 5.5 `useDuplicateTask`

- Insert baris baru: `title` = `"<judul> (copy)"`, salin `description_md` dan `due_date`, `list_id` dan `project_id` sama, `created_by` = user saat ini, `archived_at` = null.
- `position` = `positionBetween(task.position, tetanggaBawah?.position)` supaya duplikat muncul persis di bawah sumbernya. Kalau sumber adalah item terakhir, `positionBetween(task.position, undefined)`.
- Invalidate `tasksKey(projectId)` setelah sukses. Tidak optimistic — insert butuh id dari server.

### 5.6 Move to list

Pakai `useMoveTask` yang sudah ada (`{ taskId, toListId, newPosition }`). Posisi tujuan = `positionAtEnd` dari task list tujuan, jadi task mendarat di bawah.

### 5.7 Copy link

`navigator.clipboard.writeText(url)`. Bila API tidak tersedia (konteks non-HTTPS) atau promise-nya reject: toast error `"Gagal menyalin tautan."`. **Tidak ada fallback `document.execCommand`** — API-nya sudah deprecated dan konteks deploy sudah HTTPS.

---

## 6. Desain: Menu Aksi Header List

Menu sengaja ramping. Sort by, Archive all, dan Duplicate list ditolak dari scope.

| Item | Aksi |
| --- | --- |
| Rename | Aktifkan inline edit judul yang **sudah ada** di `ListColumn` (`isEditingName`). Nol UI baru |
| Add task to top | Fokuskan input tambah-task, dan sisipkan hasilnya di posisi teratas alih-alih paling bawah |
| Delete list | Destructive. `ConfirmDialog` yang sudah ada |

Pemicu: tombol `...` di header list, memakai pola `group-hover/list:opacity-100` yang sudah dipakai tombol Trash — plus selalu terlihat di bawah `sm`, sama seperti task card.

**Tombol Trash lama dicabut** dari header `ListColumn`. Delete kini hanya lewat menu. `ConfirmDialog` dan state `confirmOpen`-nya tetap dipakai.

"Add task to top" butuh `useCreateTask` menerima posisi eksplisit. Saat ini hook itu selalu memakai `positionAtEnd`. Tambahkan parameter opsional; posisi teratas dihitung dengan `positionBetween(undefined, taskPertama?.position)`.

---

## 7. Desain: Upgrade Task Detail Dialog

### 7.1 Blocker lebar dialog

`DialogContent` punya class `sm:max-w-dialog`, dan `src/index.css` mendefinisikan `--container-dialog: 24rem`. `TaskDialog` saat ini mengoper `className="max-w-2xl"` yang **tidak berpengaruh** karena utility `sm:` menang di breakpoint yang sama.

**Perbaikan:** tambahkan prop `size` di `DialogContent` (`"default" | "lg"`) yang memilih max-width lewat CVA alih-alih menabrakkan utility. `TaskDialog` memakai `size="lg"`. Dialog lain tidak berubah.

### 7.2 Layout

- `md:` ke atas — grid dua kolom. Kolom kiri: title dan description. Kolom kanan (lebih sempit): due date, metadata, dan aksi.
- Di bawah `md:` — satu kolom, urutan title → description → due date → metadata.
- QA di 375 / 768 / 1280 sesuai DESIGN.md.

### 7.3 Autosave

Mode Edit/Save global dihapus. State `isEditing` hilang.

| Field | Perilaku simpan |
| --- | --- |
| Title | Autosave **on blur**. Kosong atau tidak berubah → tidak ada request, kembalikan nilai sebelumnya |
| Due date | Autosave **on blur** |
| Description | **Tombol Save eksplisit.** Markdown panjang tidak boleh ter-flush setengah jadi; tombol muncul hanya kalau ada perubahan yang belum disimpan |

Semua simpan lewat `useUpdateTask` yang sudah ada. Gagal → toast error dan field kembali ke nilai server.

### 7.4 Metadata footer

- "Dibuat oleh {nama}" — butuh join `profiles` di `useTasks`, atau ambil dari cache member project yang sudah dipakai `MembersDialog`. Pilih yang tidak menambah request per-task.
- "Terakhir diubah {relatif}" — pakai `formatRelativeTime` yang sudah ada.
- Teks pakai `text-micro text-text-4`.

### 7.5 Menu aksi di header dialog

Komponen `TaskActionsMenu` yang sama dirender di header dialog, dipicu tombol `...` biasa (bukan right-click). Rename dinonaktifkan di sini — dialognya sudah terbuka, jadi cukup fokuskan field title.

---

## 8. Desain: Arsip

### 8.1 Query board

`useTasks` menambahkan `.is("archived_at", null)`. Semua task terarsip hilang dari board tanpa perubahan lain di komponen.

### 8.2 Hook baru

| Hook | Perilaku |
| --- | --- |
| `useArchivedTasks(projectId)` | Query key sendiri `["tasks", projectId, "archived"]`, filter `.not("archived_at", "is", null)`, urut `archived_at desc`. Cache terpisah, tidak mengotori cache board |
| `useArchiveTask(projectId)` | Optimistic: buang task dari cache board, rollback + toast bila gagal. Pola `useMoveTask` |
| `useRestoreTask(projectId)` | Set `archived_at = null`. Invalidate cache board dan cache arsip |

Delete permanen dari dialog Archived memakai `useDeleteTask` yang sudah ada.

### 8.3 Dialog Archived

- Dibuka dari header board.
- Tiap baris: judul task, nama list asal, waktu diarsipkan relatif, tombol Restore dan Delete permanen.
- Delete permanen lewat `ConfirmDialog`.
- Kosong → `EmptyState` "Belum ada task terarsip".
- Restore mengembalikan task ke `list_id` yang tersimpan di barisnya. Bila list itu dihapus, task terarsip ikut terhapus: `tasks.list_id` adalah `references lists(id) on delete cascade` (terverifikasi di `20260906000000_init_schema.sql`). Jadi tidak ada task arsip yatim, dan Restore selalu punya list tujuan yang valid.

### 8.4 Header board sudah ramai

Header saat ini memuat: Back, judul, Members, Export, input "New list name", Add list, ThemeToggle. Menambah tombol Archived membuatnya makin padat, terutama di 375.

**Keputusan:** konsolidasikan Members, Export, dan Archived ke dalam satu menu `...` di header board memakai komponen `menu.tsx` yang sudah ada. Back, judul, Add list, dan ThemeToggle tetap terlihat langsung.

---

## 9. Keamanan

- **Otorisasi** — semua operasi baru (archive, restore, duplicate, move) lewat tabel `tasks` yang sudah dilindungi RLS berbasis `is_project_member`. Tidak ada endpoint baru, tidak ada policy baru.
- **Deep-link tidak membocorkan data** — `?task=<id>` hanya mencari di dalam daftar task yang sudah difetch untuk project ini. Id dari project lain tidak akan ketemu dan berakhir sebagai toast "tidak ditemukan". Tidak ada fetch by id tersendiri yang bisa dipakai menebak keberadaan task orang lain.
- **Clipboard** — hanya menulis URL yang dibangun dari `projectId` dan `taskId` milik sendiri. Tidak ada data user lain yang tersalin.
- **Duplicate** — `created_by` di-set ke user saat ini, bukan disalin dari sumber, supaya kepemilikan tidak dipalsukan.
- **XSS** — description hasil duplicate tetap melewati `renderMarkdown` (marked + DOMPurify) yang sama saat ditampilkan. Tidak ada jalur render baru.
- **Archive bukan kontrol akses** — task terarsip tetap terbaca oleh semua member project. Ini fitur kerapian, bukan privasi.

---

## 10. Type & Lokasi File

### 10.1 File baru

| File | Isi |
| --- | --- |
| `supabase/migrations/20260908000000_task_archive.sql` | Kolom `archived_at` + index parsial |
| `src/features/board/TaskActionsMenu.tsx` | Menu aksi task, dipakai card (context menu) dan dialog (tombol) |
| `src/features/board/ListActionsMenu.tsx` | Menu aksi header list |
| `src/features/board/ArchivedDialog.tsx` | Daftar task terarsip + Restore + Delete permanen |
| `src/features/board/useArchivedTasks.ts` | Hook query arsip (boleh digabung ke `useTasks.ts` bila lebih rapi) |
| `src/components/ui/context-menu.tsx` | Pembungkus tipis `@base-ui/react/context-menu` mengikuti gaya `menu.tsx` |

### 10.2 File yang berubah

| File | Perubahan |
| --- | --- |
| `src/types/database.types.ts` | Tambah `archived_at: string \| null` di `tasks` |
| `src/features/board/useTasks.ts` | Filter `.is("archived_at", null)`; hook `useDuplicateTask`, `useArchiveTask`, `useRestoreTask`; `useCreateTask` menerima posisi opsional |
| `src/features/board/TaskCard.tsx` | Bungkus dengan context menu; tombol `...` untuk mobile |
| `src/features/board/TaskDialog.tsx` | Layout dua kolom, autosave, metadata footer, `TaskActionsMenu`, `size="lg"` |
| `src/features/board/ListColumn.tsx` | Ganti tombol Trash dengan `ListActionsMenu`; dukung "Add task to top" |
| `src/features/board/BoardPage.tsx` | `useSearchParams` menggantikan `openTaskId`; konsolidasi header ke satu menu; render `ArchivedDialog` |
| `src/components/ui/dialog.tsx` | Prop `size` di `DialogContent` |
| `src/components/ui/menu.tsx` | Tambah `MenuSubmenu` dan `MenuSubmenuTrigger` untuk "Move to list" |

---

## 11. Alur End-to-End

**Archive lalu restore**
Right-click card → Archive → task lenyap dari board seketika (optimistic) → buka menu header board → Archived → baris task tampil → Restore → task kembali ke list asalnya di posisi tersimpan.

**Deep-link**
Salin link dari menu card → tempel di tab lain → board memuat → param `task` terbaca → dialog task terbuka → tutup dialog → param hilang, URL kembali bersih.

**Edit lewat autosave**
Buka task → ubah title → klik di luar field → tersimpan, tanpa tombol → ubah description → tombol Save muncul → klik Save → tersimpan → footer "Terakhir diubah" ikut berubah.

---

## 12. Kriteria Sukses

- [ ] Right-click task card membuka menu di desktop; tombol `...` membukanya di 375.
- [ ] Tekan-tahan card di perangkat sentuh memulai drag, bukan membuka menu.
- [ ] Keenam aksi task berfungsi; Delete dan Delete permanen keduanya lewat konfirmasi.
- [ ] Menu list punya tepat tiga item; tombol Trash lama sudah tidak ada.
- [ ] Task dialog lebih lebar dari 24rem dan berlayout dua kolom di ≥768.
- [ ] Title dan due date tersimpan saat blur; description butuh klik Save.
- [ ] `?task=<id>` membuka dialog yang benar; id tak valid memberi toast dan membersihkan URL.
- [ ] Task terarsip hilang dari board dan muncul di dialog Archived.
- [ ] Restore mengembalikan task ke list asalnya.
- [ ] `rtk npm run build` hijau.
- [ ] QA visual di 375 / 768 / 1280 tanpa overflow atau teks terpotong.

---

## 13. Pertanyaan Terbuka untuk Maintainer

1. **Apakah long-press ContextMenu bisa dimatikan lewat prop di Base UI 1.8?** Kalau tidak ada, rencananya membiarkan dnd-kit menang di sentuh. *Rekomendasi: cek dokumen saat implementasi; kalau buntu, terima drag menang.*
2. **Nama pembuat task diambil dari mana?** Join `profiles` di query tasks menambah kolom di tiap baris; membaca dari cache member menghindari itu tapi butuh member sudah terfetch. *Rekomendasi: pakai cache member, fallback "—" bila belum ada.*
3. **Konsolidasi header board ke satu menu — apakah Export dan Members boleh kehilangan tombol langsungnya?** *Rekomendasi: boleh; keduanya aksi jarang.*
4. **Perlukah undo untuk Archive?** Toast dengan tombol Undo akan enak dipakai tapi menambah kerumitan. *Rekomendasi: lewati di Fase 5; dialog Archived sudah menjadi jalur pemulihan.*
5. **Duplicate: perlu optimistic update?** Saat ini direncanakan menunggu server karena `id` baru datang dari sana, jadi ada jeda sebelum kartu muncul. *Rekomendasi: terima jeda; insert satu baris cepat dan kompleksitas id sementara tidak sepadan.*

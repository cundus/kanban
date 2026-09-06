# PRD: Aplikasi Manajemen Proyek Pribadi (Kanban ala Trello)

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 6 September 2026 |
| **Product Owner** | Fauzan Rahman |
| **Status** | Draft — siap untuk implementasi |

---

## 1. Ringkasan & Latar Belakang

Aplikasi manajemen proyek pribadi bergaya Trello (papan Kanban: list/kolom + kartu task yang bisa di-drag & drop), untuk penggunaan pribadi dan kolaborasi skala kecil (mengundang beberapa member). Constraint utama adalah **resource hosting**: VPS 2 core / 4GB RAM yang sudah menjalankan banyak aplikasi lain, sehingga aplikasi ini harus memakai jejak resource seminimal mungkin di VPS, dengan beban komputasi/berat dilimpahkan ke **Supabase (free tier)**.

## 2. Tujuan

- Tersedia alat Kanban pribadi tanpa biaya langganan (self-hosted + Supabase free tier).
- Footprint di VPS mendekati nol (idealnya cuma serving static file).
- Fitur inti cukup untuk workflow harian: login, buat proyek, undang orang, kelola task dengan drag & drop, tulis deskripsi dalam markdown, dan bisa backup/restore data via JSON.

## 3. Target Pengguna & Skala

- Pengguna utama: 1 admin (pemilik) + beberapa member yang diundang (estimasi < 20 user aktif, beberapa proyek).
- Skala ini didesain supaya **muat nyaman di Supabase free tier** (lihat §7.3).

## 4. Lingkup Fitur (Functional Requirements)

### 4.1 Autentikasi
- Login via **Google OAuth** (satu-satunya metode login — tidak perlu form email/password sendiri, mengurangi kompleksitas & risiko keamanan).
- Session ditangani oleh Supabase Auth (JWT), auto-refresh token di client.

### 4.2 Invite Member
- Owner project bisa mengundang orang lain via email.
- Alur sederhana (tanpa perlu server email pribadi):
  1. Owner input email → sistem membuat baris di tabel `project_members` dengan status `pending` + `invited_email`.
  2. Owner membagikan link project secara manual (chat/WA), **atau** pakai Supabase's built-in email invite kalau mau otomatis (kena limit rate email bawaan Supabase — cukup untuk skala pribadi).
  3. Saat orang yang diundang login dengan Google memakai email yang sama, sistem mencocokkan `invited_email` dengan email akun Google → status berubah jadi `accepted` dan `user_id` terisi.
- Role sederhana: `owner` (bisa CRUD penuh + invite/remove member) dan `member` (CRUD task, tidak bisa hapus project/invite).

### 4.3 Project CRUD
- Create / Read / Update / Delete project.
- Setiap project punya: nama, deskripsi singkat, daftar list/kolom (mis. "To Do", "In Progress", "Done" — bisa dikustomisasi), dan daftar member.

### 4.4 Task CRUD + Drag & Drop
- Task punya: judul, deskripsi (markdown), due date (opsional), urutan/posisi, list/kolom tempat dia berada.
- Drag & drop untuk:
  - Memindah task antar kolom (mis. To Do → In Progress).
  - Mengubah urutan task dalam satu kolom.
- Update posisi disimpan ke Supabase secara **optimistic** (UI update duluan, sinkron ke server di belakang) supaya terasa instan.
- Strategi posisi: pakai **fractional index** (angka desimal/float) agar drag-drop satu kartu tidak perlu re-write semua baris lain — hemat query & tetap ringan meski data besar.

### 4.5 Import & Export JSON
- **Export**: tombol di halaman project → generate file `.json` berisi struktur project (list + task + metadata) → download langsung di browser (proses 100% di client, tidak membebani VPS/Supabase).
- **Import**: upload file `.json` → divalidasi strukturnya di client → data di-insert ke Supabase (project baru atau menimpa yang ada, sesuai pilihan user).
- Use case: backup manual, restore, duplikasi project jadi template.

### 4.6 Markdown Editor
- Field deskripsi task mendukung Markdown.
- Mode: **tulis (raw markdown) ↔ preview** (toggle atau split view), dirender pakai library ringan (`marked` atau `markdown-it`), bukan WYSIWYG editor berat (hindari TipTap/ProseMirror agar bundle tetap kecil).

## 5. Di Luar Lingkup (Out of Scope — v1)

- Notifikasi real-time / email otomatis selain invite dasar.
- Komentar per task, activity log, attachment file.
- Multi-workspace/organization (cukup 1 tenant = akun Google Fauzan + member yang diundang).
- Aplikasi mobile native (cukup web responsif).
- Automation/rules engine, integrasi pihak ketiga (Slack, dll).

*(Bisa jadi kandidat fase berikutnya, lihat §9.)*

## 6. Arsitektur & Tech Stack

Prinsip desain: **"VPS cuma jadi tukang serve file statis"**. Semua logic stateful (auth, database, otorisasi, realtime) dilimpahkan ke Supabase, supaya VPS yang sudah padat aplikasi lain tidak kena beban tambahan proses backend.

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend framework | **React + Vite** (SPA, build jadi static file) | Ekosistem library terlengkap untuk drag & drop (`@dnd-kit`) dan Supabase client; build output statis murni HTML/JS/CSS |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Ringan (~10KB gzip), aktif dimaintain, pengganti react-beautiful-dnd yang sudah deprecated |
| Markdown | `marked` atau `markdown-it` (render) + textarea biasa (input) | Jauh lebih ringan daripada rich-text editor berbasis ProseMirror/TipTap |
| Backend / DB / Auth | **Supabase** (Postgres + PostgREST + Auth + Realtime) | Free tier menutupi kebutuhan skala pribadi; tidak perlu server backend custom sama sekali — frontend bicara langsung ke Supabase via `supabase-js` |
| Otorisasi data | **Row Level Security (RLS)** Postgres di Supabase | Aturan akses (siapa boleh lihat/edit project apa) ditegakkan di level database, bukan di server custom |
| Hosting VPS | Static file di balik reverse proxy yang **sudah ada** (Nginx/Caddy/Traefik) — cukup 1 folder `dist/`, atau container `nginx:alpine` (±10MB image, RAM idle <20MB) | Tidak ada proses Node.js/PHP yang jalan terus-menerus di VPS → jejak resource nyaris nol |
| Realtime update (opsional) | Supabase Realtime (subscribe perubahan tabel) | Kalau mau board auto-update saat member lain edit, tanpa perlu WebSocket server sendiri |

**Yang sengaja dihindari** agar tetap ringan: server Node/Express custom, database sendiri di VPS (Postgres/MySQL lokal), rich-text editor berat, dan proses build/render di sisi server (SSR) — semuanya statis + client-side.

## 7. Data Model & Kebutuhan Non-Fungsional

### 7.1 Skema Data (Postgres via Supabase)

| Tabel | Kolom Penting |
|---|---|
| `profiles` | `id` (= `auth.users.id`), `email`, `full_name`, `avatar_url` |
| `projects` | `id`, `name`, `description`, `owner_id`, `created_at` |
| `project_members` | `project_id`, `user_id` (nullable saat pending), `invited_email`, `role` (`owner`/`member`), `status` (`pending`/`accepted`) |
| `lists` | `id`, `project_id`, `name`, `position` |
| `tasks` | `id`, `list_id`, `project_id`, `title`, `description_md`, `due_date`, `position`, `created_by`, `updated_at` |

RLS policy inti: user hanya boleh `select/insert/update/delete` baris yang `project_id`-nya ada di `project_members` miliknya (dan role sesuai untuk aksi tertentu, mis. hanya `owner` yang boleh hapus project atau invite/remove member).

### 7.2 Non-Functional Requirements

- **Resource budget VPS**: target idle RAM < 50MB, idle CPU mendekati 0% (tercapai karena hanya static hosting).
- **Keamanan**: HTTPS via reverse proxy yang sudah ada; satu-satunya kredensial di frontend adalah Supabase URL + anon public key (aman by design karena akses data sepenuhnya ditegakkan RLS, bukan oleh kerahasiaan key).
- **Performa**: drag & drop harus terasa instan (optimistic update), sinkronisasi ke Supabase di background.

### 7.3 Batasan Supabase Free Tier (perlu diperhatikan)

Per pengecekan terbaru, free tier Supabase mencakup kira-kira: 500MB database, 1GB file storage, ±5GB bandwidth/bulan, 50.000 monthly active users, maksimal 2 project aktif, dan **project akan di-pause otomatis setelah ±1 minggu tanpa aktivitas** (bisa direstore manual dari dashboard). Untuk skala pribadi/tim kecil ini jauh dari batas database/storage, tapi **auto-pause karena inactivity** perlu diantisipasi — misalnya dengan cron ping ringan (mis. lewat cron-job.org) yang hit endpoint Supabase seminggu sekali, atau cukup diterima risikonya karena penggunaan pribadi. Karena kebijakan pricing bisa berubah, disarankan cek ulang ke supabase.com/pricing sebelum implementasi final.

## 8. Rencana Deployment

1. Buat project Supabase → set up tabel & RLS policy (lewat SQL editor / Supabase CLI migration).
2. Aktifkan provider **Google** di Supabase Auth (butuh OAuth Client ID/Secret dari Google Cloud Console, redirect URI diarahkan ke callback Supabase).
3. Build frontend (`vite build` → folder `dist/`).
4. Deploy `dist/` sebagai static site baru di reverse proxy VPS yang sudah berjalan (subdomain baru, mis. `board.domainkamu.com`), atau via container `nginx:alpine` minimal.
5. Konfigurasi SSL (pakai setup certbot/reverse proxy yang sudah ada di VPS).
6. Environment variable (Supabase URL + anon key) di-embed saat build — aman dipublikasikan karena RLS.

## 9. Roadmap / Fase Pengembangan

| Fase | Scope |
|---|---|
| **Fase 1 — MVP** | Login Google, Project CRUD, List & Task CRUD (tanpa drag-drop, urutan manual), deskripsi markdown (render saja) |
| **Fase 2** | Drag & drop penuh (`@dnd-kit` + fractional position), markdown editor tulis+preview |
| **Fase 3** | Invite member + RLS multi-user |
| **Fase 4** | Import & Export JSON |
| **Fase 5 (opsional)** | Due date & reminder sederhana, label/tag warna, dark mode, attachment file via Supabase Storage, activity log |

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Project Supabase di-pause karena free tier tidak dipakai >1 minggu | Cron ping ringan, atau terima manual-restore karena pemakaian pribadi |
| Google OAuth setup awal cukup ribet (Google Cloud Console) | Ikuti panduan resmi Supabase Auth + Google sekali di awal, biasanya one-time setup |
| Bandwidth 5GB/bulan bisa kepakai kalau ada banyak gambar/attachment | v1 sengaja tidak termasuk file attachment (lihat §5); tambah nanti dengan hati-hati terhadap kuota storage |
| Konflik posisi saat drag-drop bersamaan oleh 2 user | Skala kecil, risiko rendah; kalau perlu, tambah Realtime subscription supaya board auto-refresh saat ada perubahan dari member lain |

## 11. Kriteria Sukses

- Semua fitur inti (§4) berjalan dan dipakai harian untuk tracking task pribadi/tim kecil.
- Tidak ada penambahan proses backend permanen di VPS (cek `htop`/resource monitor sebelum-sesudah deploy).
- Tetap berada dalam batas free tier Supabase tanpa perlu upgrade paid plan.

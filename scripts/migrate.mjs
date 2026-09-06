#!/usr/bin/env node
/**
 * migrate.mjs — runner migrasi database sederhana untuk Supabase Postgres.
 *
 * Tujuan: menerapkan file SQL di supabase/migrations/ ke database langsung dari
 * command line, tanpa menempel SQL manual di dashboard. Zero-build (Node ESM).
 *
 * DEPENDENSI: paket 'pg' (node-postgres).
 *   Install:  pnpm add -D pg
 *   Hanya dibutuhkan untuk perintah yang benar-benar konek DB ("up" tanpa
 *   --dry-run dan "baseline"). Perintah "status" & "up --dry-run" jalan tanpa 'pg'.
 *
 * KONFIGURASI:
 *   Set env DATABASE_URL ke connection string Postgres Supabase MODE SESSION
 *   ("Direct connection": host db.<project-ref>.supabase.co, port 5432).
 *   JANGAN pakai transaction pooler (port 6543) — DDL seperti ALTER TABLE tidak
 *   boleh lewat pooler. DATABASE_URL juga bisa ditaruh di file .env root repo
 *   (format KEY=VALUE per baris; env asli tidak ditimpa).
 *
 * ALUR PERTAMA KALI (skema init sudah diterapkan manual ke project live):
 *   1) node scripts/migrate.mjs status        -> lihat daftar file + statusnya
 *   2) node scripts/migrate.mjs baseline init -> tandai init schema "applied"
 *                                                TANPA menjalankan ulang SQL-nya
 *   3) node scripts/migrate.mjs up            -> terapkan semua file pending
 *                                                berikutnya, berurutan
 *
 * Perintah lain:
 *   node scripts/migrate.mjs up --dry-run   -> tampilkan rencana, tanpa konek DB
 *   node scripts/migrate.mjs help
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const TRACKING_TABLE = 'schema_migrations';

// --- Loader .env minimal (tanpa dependensi tambahan) ---------------------------
function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv();

// --- Util --------------------------------------------------------------------
const log = (msg = '') => console.log(msg);
const err = (msg = '') => console.error(msg);

function listMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) {
    err(`Direktori migrasi tidak ditemukan: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();
}

function resolveFilename(arg, files) {
  if (!arg) return null;
  if (files.includes(arg)) return arg;
  const matches = files.filter((f) => f.includes(arg));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    err(`Argumen "${arg}" ambigu, cocok dengan: ${matches.join(', ')}`);
    process.exit(1);
  }
  err(`File migrasi tidak ditemukan untuk: ${arg}`);
  process.exit(1);
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    err('DATABASE_URL belum diset. Set env tersebut atau isi file .env di root repo.');
    err('Harus connection string Postgres Supabase mode SESSION (port 5432 / Direct),');
    err('bukan transaction pooler (port 6543).');
    process.exit(1);
  }
  return url;
}

async function connect() {
  const url = requireDatabaseUrl();
  let pg;
  try {
    pg = await import('pg');
  } catch {
    err("Paket 'pg' belum terpasang. Jalankan: pnpm add -D pg");
    process.exit(1);
  }
  const Client = pg.default?.Client ?? pg.Client;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
  } catch (e) {
    err(`Gagal konek ke database: ${e.message}`);
    process.exit(1);
  }
  return client;
}

async function ensureTrackingTable(client) {
  await client.query(
    `create table if not exists ${TRACKING_TABLE} (
       filename   text primary key,
       applied_at timestamptz not null default now(),
       baseline   boolean not null default false
     )`,
  );
  // Jaga-jaga bila tabel dibuat versi lama tanpa kolom baseline.
  await client.query(
    `alter table ${TRACKING_TABLE} add column if not exists baseline boolean not null default false`,
  );
}

async function getApplied(client) {
  await ensureTrackingTable(client);
  const res = await client.query(
    `select filename, baseline from ${TRACKING_TABLE}`,
  );
  const map = new Map();
  for (const row of res.rows) map.set(row.filename, row);
  return map;
}

// --- Perintah: status ------------------------------------------------------
async function cmdStatus() {
  const files = listMigrationFiles();
  if (files.length === 0) {
    log('Tidak ada file migrasi di supabase/migrations/.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    log('DATABASE_URL belum diset — tidak konek DB. Menampilkan daftar file saja:');
    log('');
    for (const f of files) log(`  [?]        ${f}`);
    log('');
    log('Set DATABASE_URL lalu jalankan lagi untuk melihat applied/pending.');
    return;
  }

  const client = await connect();
  try {
    const applied = await getApplied(client);
    log('Status migrasi:');
    log('');
    for (const f of files) {
      const row = applied.get(f);
      if (!row) {
        log(`  [pending]  ${f}`);
      } else if (row.baseline) {
        log(`  [applied]  ${f}  (baseline)`);
      } else {
        log(`  [applied]  ${f}`);
      }
    }
    const pendingCount = files.filter((f) => !applied.has(f)).length;
    log('');
    log(`Total: ${files.length} file, ${pendingCount} pending.`);
  } finally {
    await client.end();
  }
}

// --- Perintah: up --------------------------------------------------------
async function cmdUp({ dryRun }) {
  const files = listMigrationFiles();

  if (dryRun) {
    log('DRY-RUN — tidak konek ke database.');
    if (!process.env.DATABASE_URL) log('(Catatan: DATABASE_URL belum diset.)');
    log('');
    if (files.length === 0) {
      log('Tidak ada file migrasi.');
      return;
    }
    log('File yang akan dijalankan bila masih pending (urutan sesuai nama file):');
    for (const f of files) log(`  ${f}`);
    log('');
    log('Setiap file dibungkus satu transaksi: BEGIN; <sql file>; INSERT tracking; COMMIT.');
    log('Bila satu file gagal: ROLLBACK file itu, berhenti, exit code != 0.');
    return;
  }

  const client = await connect();
  try {
    const applied = await getApplied(client);
    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      log('Tidak ada migrasi pending. Database sudah paling baru.');
      return;
    }
    log(`Migrasi pending: ${pending.length}`);
    for (const f of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      log('');
      log(`-> Menerapkan ${f} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `insert into ${TRACKING_TABLE} (filename) values ($1)`,
          [f],
        );
        await client.query('COMMIT');
        log(`   OK: ${f} diterapkan.`);
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        err('');
        err(`GAGAL menerapkan ${f}:`);
        err(`   ${e.message}`);
        err('ROLLBACK sudah dijalankan untuk file ini. File berikutnya TIDAK dijalankan.');
        process.exitCode = 1;
        return;
      }
    }
    log('');
    log('Selesai. Semua migrasi pending berhasil diterapkan.');
  } finally {
    await client.end();
  }
}

// --- Perintah: baseline --------------------------------------------------
async function cmdBaseline(arg, { dryRun }) {
  const files = listMigrationFiles();
  const target = resolveFilename(arg, files); // null bila tanpa argumen

  if (dryRun) {
    log('DRY-RUN — tidak konek ke database.');
    if (target) {
      log(`Akan menandai ${target} sebagai applied (baseline) TANPA menjalankan SQL-nya.`);
    } else {
      log('Tanpa argumen: akan mem-baseline file pending paling awal (butuh DB untuk menentukannya).');
    }
    return;
  }

  const client = await connect();
  try {
    const applied = await getApplied(client);
    let file = target;
    if (!file) {
      const pending = files.filter((f) => !applied.has(f));
      if (pending.length === 0) {
        log('Tidak ada file pending untuk di-baseline.');
        return;
      }
      file = pending[0];
    }
    if (applied.has(file)) {
      log(`${file} sudah tercatat sebagai applied. Tidak ada perubahan.`);
      return;
    }
    await client.query(
      `insert into ${TRACKING_TABLE} (filename, baseline) values ($1, true)`,
      [file],
    );
    log(`Baseline: ${file} ditandai "applied" tanpa menjalankan SQL-nya.`);
  } finally {
    await client.end();
  }
}

// --- Bantuan --------------------------------------------------------------
function usage() {
  log(`
migrate.mjs — runner migrasi Supabase Postgres

Penggunaan:
  node scripts/migrate.mjs <perintah> [opsi]

Perintah:
  status             Tampilkan tiap file migrasi: applied / pending (+ penanda baseline).
  up [--dry-run]     Terapkan semua file pending berurutan; tiap file dalam satu
                     transaksi (BEGIN; sql; INSERT tracking; COMMIT). Bila gagal:
                     ROLLBACK file itu, berhenti, exit code != 0, file berikutnya
                     tidak dijalankan. --dry-run: tampilkan rencana tanpa konek DB.
  baseline [file]    Tandai file sebagai applied TANPA menjalankan SQL-nya (untuk
                     init schema yang sudah diterapkan manual). Tanpa argumen:
                     baseline file pending paling awal. "file" boleh nama lengkap
                     atau potongan unik (mis. "init").
  help               Tampilkan bantuan ini.

Konfigurasi:
  DATABASE_URL   Connection string Postgres Supabase mode SESSION (port 5432 /
                 "Direct connection"), BUKAN transaction pooler (port 6543) karena
                 DDL seperti ALTER TABLE harus lewat koneksi langsung. Bisa juga
                 diletakkan di file .env pada root repo.

Dependensi:
  Paket 'pg' (node-postgres) — install: pnpm add -D pg. Hanya dibutuhkan untuk
  perintah yang konek DB ("up" tanpa --dry-run, dan "baseline").

Alur pertama kali (skema init sudah diterapkan manual):
  1) node scripts/migrate.mjs status
  2) node scripts/migrate.mjs baseline init
  3) node scripts/migrate.mjs up
`);
}

// --- Entry point --------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positionals = args.filter((a) => !a.startsWith('--'));
  const cmd = positionals[0] ?? 'help';
  const opts = { dryRun: flags.has('--dry-run') };

  switch (cmd) {
    case 'status':
      await cmdStatus();
      break;
    case 'up':
      await cmdUp(opts);
      break;
    case 'baseline':
      await cmdBaseline(positionals[1], opts);
      break;
    case 'help':
    case '--help':
    case '-h':
      usage();
      break;
    default:
      err(`Perintah tidak dikenal: ${cmd}`);
      err('');
      usage();
      process.exitCode = 1;
  }
}

main().catch((e) => {
  err(`Error tak terduga: ${e?.stack ?? e}`);
  process.exit(1);
});

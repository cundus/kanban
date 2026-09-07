import { POSITION_STEP } from "@/features/board/reorderUtils"
import { FORMAT_ID, FORMAT_VERSION, type ExportDocV1 } from "./exportFormat"

/** Batas defensif — jauh di atas kebutuhan pribadi, tapi membatasi payload file jahil. */
export const MAX_LISTS = 100
export const MAX_TASKS = 2000
export const MAX_TASK_DESC = 20000
export const MAX_PROJECT_DESC = 2000
export const MAX_NAME = 200
export const MAX_TITLE = 500

export type ValidateResult =
  | { ok: true; doc: ExportDocV1 }
  | { ok: false; errors: string[] }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isValidDueDate(v: unknown): boolean {
  if (v == null) return true
  if (typeof v !== "string") return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  return Number.isFinite(Date.parse(v))
}

/**
 * Validasi murni sebuah nilai hasil `JSON.parse` terhadap format export v1.
 * Semua pesan Bahasa Indonesia. Error dikumpulkan (bukan gagal di error pertama),
 * kecuali yang fatal: bukan objek / format salah / versi tidak didukung.
 * Tidak pernah melempar exception; tidak mengimpor React / supabase.
 */
export function validateImport(raw: unknown): ValidateResult {
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ["File tidak berisi objek JSON yang valid."] }
  }

  if (raw.format !== FORMAT_ID) {
    return {
      ok: false,
      errors: ["File ini bukan hasil export Personal Kanban."],
    }
  }

  if (raw.version !== FORMAT_VERSION) {
    const msg =
      typeof raw.version === "number" && raw.version > FORMAT_VERSION
        ? "File dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi lalu coba lagi."
        : "Versi format file tidak didukung."
    return { ok: false, errors: [msg] }
  }

  const errors: string[] = []

  // --- project ---
  const project = raw.project
  if (!isPlainObject(project)) {
    errors.push("Data project pada file tidak valid.")
  } else {
    const name = project.name
    if (typeof name !== "string" || name.trim().length === 0) {
      errors.push("Nama project wajib ada dan tidak boleh kosong.")
    } else if (name.length > MAX_NAME) {
      errors.push(`Nama project terlalu panjang (maks ${MAX_NAME} karakter).`)
    }
    const description = project.description
    if (
      description != null &&
      (typeof description !== "string" || description.length > MAX_PROJECT_DESC)
    ) {
      errors.push("Deskripsi project terlalu panjang (maks 2.000 karakter).")
    }
  }

  // --- lists + tasks ---
  const lists = raw.lists
  if (!Array.isArray(lists)) {
    errors.push("Data list pada file tidak valid.")
  } else {
    if (lists.length > MAX_LISTS) {
      errors.push("Jumlah list melebihi batas (maks 100).")
    }

    let totalTasks = 0
    lists.forEach((list, i) => {
      if (!isPlainObject(list)) {
        errors.push(`List ke-${i + 1} pada file tidak valid.`)
        return
      }
      const listName = list.name
      if (typeof listName !== "string" || listName.trim().length === 0) {
        errors.push(`List ke-${i + 1} tidak punya nama yang valid.`)
      } else if (listName.length > MAX_NAME) {
        errors.push(`Nama list ke-${i + 1} terlalu panjang (maks ${MAX_NAME} karakter).`)
      }

      const tasks = list.tasks
      if (!Array.isArray(tasks)) {
        errors.push(`List ke-${i + 1} tidak punya daftar task yang valid.`)
        return
      }
      totalTasks += tasks.length
      const label = typeof listName === "string" ? listName : `ke-${i + 1}`

      tasks.forEach((task, j) => {
        if (!isPlainObject(task)) {
          errors.push(`Task ke-${j + 1} di list "${label}" tidak valid.`)
          return
        }
        const title = task.title
        if (typeof title !== "string" || title.trim().length === 0) {
          errors.push(`Task ke-${j + 1} di list "${label}" tidak punya judul yang valid.`)
        } else if (title.length > MAX_TITLE) {
          errors.push(`Judul salah satu task terlalu panjang (maks ${MAX_TITLE} karakter).`)
        }
        const desc = task.description_md
        if (desc != null && (typeof desc !== "string" || desc.length > MAX_TASK_DESC)) {
          errors.push("Deskripsi salah satu task terlalu panjang (maks 20.000 karakter).")
        }
        if (!isValidDueDate(task.due_date)) {
          errors.push(
            "Tanggal jatuh tempo salah satu task tidak valid (format YYYY-MM-DD)."
          )
        }
      })
    })

    if (totalTasks > MAX_TASKS) {
      errors.push("Jumlah task melebihi batas (maks 2.000).")
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors: [...new Set(errors)] }
  }
  return { ok: true, doc: raw as unknown as ExportDocV1 }
}

export interface NormalizedImport {
  project: { name: string; description: string | null }
  lists: Array<{
    name: string
    position: number
    tasks: Array<{
      title: string
      description_md: string | null
      due_date: string | null
      position: number
    }>
  }>
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

/**
 * Ubah dokumen valid menjadi struktur siap-insert. `trim()` semua string;
 * description kosong → `null`; `position` dihitung ulang dari indeks array
 * (`(i + 1) * POSITION_STEP`) sehingga nilai `position` di file diabaikan total.
 * Hanya key yang dikenal yang disalin.
 */
export function normalizeImport(doc: ExportDocV1): NormalizedImport {
  return {
    project: {
      name: doc.project.name.trim(),
      description: trimOrNull(doc.project.description),
    },
    lists: doc.lists.map((list, i) => ({
      name: list.name.trim(),
      position: (i + 1) * POSITION_STEP,
      tasks: list.tasks.map((task, j) => ({
        title: task.title.trim(),
        description_md: trimOrNull(task.description_md),
        due_date: typeof task.due_date === "string" ? task.due_date : null,
        position: (j + 1) * POSITION_STEP,
      })),
    })),
  }
}

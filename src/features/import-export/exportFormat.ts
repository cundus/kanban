import type { Database } from "@/types/database.types"

/** Penanda format file export native. File dengan `format` lain ditolak saat import. */
export const FORMAT_ID = "personal-kanban-export"
/** Versi format. Import v1 hanya menerima angka ini. */
export const FORMAT_VERSION = 1 as const

export interface ExportTask {
  title: string
  description_md: string | null
  due_date: string | null
  /** Informasional — diabaikan saat import (posisi dihitung ulang dari urutan array). */
  position: number
  /** Informasional — diabaikan saat import. */
  updated_at: string
}

export interface ExportList {
  name: string
  /** Informasional — diabaikan saat import. */
  position: number
  tasks: ExportTask[]
}

export interface ExportProject {
  name: string
  description: string | null
  /** Informasional — diabaikan saat import. */
  createdAt: string
}

export interface ExportDocV1 {
  format: typeof FORMAT_ID
  version: typeof FORMAT_VERSION
  /** ISO 8601 UTC, informasional. */
  exportedAt: string
  project: ExportProject
  lists: ExportList[]
}

type Project = Database["public"]["Tables"]["projects"]["Row"]
type List = Database["public"]["Tables"]["lists"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]

/**
 * Bangun dokumen export v1 dari data project/list/task.
 *
 * Deterministik selain argumen `now` (yang default ke waktu sekarang) —
 * parameter itu ada khusus supaya self-check bisa memberi nilai tetap.
 * Tidak mengimpor React / supabase: murni transform data.
 */
export function buildExport(
  project: Pick<Project, "name" | "description" | "created_at">,
  lists: Pick<List, "id" | "name" | "position">[],
  tasks: Pick<
    Task,
    "list_id" | "title" | "description_md" | "due_date" | "position" | "updated_at"
  >[],
  now: string = new Date().toISOString(),
): ExportDocV1 {
  const sortedLists = [...lists].sort((a, b) => a.position - b.position)

  const exportLists: ExportList[] = sortedLists.map((list) => {
    const listTasks = tasks
      .filter((t) => t.list_id === list.id)
      .sort((a, b) => a.position - b.position)
      .map<ExportTask>((t) => ({
        title: t.title,
        description_md: t.description_md,
        due_date: t.due_date,
        position: t.position,
        updated_at: t.updated_at,
      }))
    return { name: list.name, position: list.position, tasks: listTasks }
  })

  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    exportedAt: now,
    project: {
      name: project.name,
      description: project.description,
      createdAt: project.created_at,
    },
    lists: exportLists,
  }
}

/**
 * Nama file unduhan: `kanban-<slug>-<YYYY-MM-DD>.json`.
 * `slug` di-normalisasi ke `[a-z0-9-]`, dipangkas ≤ 40 char; fallback `"project"`.
 */
export function exportFileName(name: string, date: Date = new Date()): string {
  const slug =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "project"
  const day = date.toISOString().slice(0, 10)
  return `kanban-${slug}-${day}.json`
}

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { buildExport, exportFileName } from "./exportFormat"

type Project = Database["public"]["Tables"]["projects"]["Row"]
type List = Database["public"]["Tables"]["lists"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]

/**
 * Unduh satu file `.json` berisi project + lists + tasks + metadata versi/timestamp.
 * Membaca data dari cache TanStack Query bila ada (board sudah memuatnya),
 * fallback fetch langsung ke Supabase. Tersedia untuk owner & member.
 */
export function useExportProject(projectId: string) {
  const queryClient = useQueryClient()

  const exportNow = useCallback(async () => {
    try {
      let project = queryClient.getQueryData<Project>(["project", projectId])
      if (!project) {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single()
        if (error) throw error
        project = data as Project
      }

      let lists = queryClient.getQueryData<List[]>(["lists", projectId])
      if (!lists) {
        const { data, error } = await supabase
          .from("lists")
          .select("*")
          .eq("project_id", projectId)
          .order("position", { ascending: true })
        if (error) throw error
        lists = data as List[]
      }

      let tasks = queryClient.getQueryData<Task[]>(["tasks", projectId])
      if (!tasks) {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("project_id", projectId)
          .order("position", { ascending: true })
        if (error) throw error
        tasks = data as Task[]
      }

      const doc = buildExport(project, lists, tasks)
      const json = JSON.stringify(doc, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      try {
        a.href = url
        a.download = exportFileName(project.name)
        document.body.appendChild(a)
        a.click()
      } finally {
        a.remove()
        URL.revokeObjectURL(url)
      }
      toast.success("File export berhasil dibuat.")
    } catch (err) {
      console.error(err)
      toast.error("Gagal membuat file export.")
    }
  }, [projectId, queryClient])

  return { exportNow }
}

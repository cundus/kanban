import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { normalizeImport, validateImport } from "./importValidation"

/**
 * Import file JSON hasil export → membuat **project baru** milik user yang meng-import.
 *
 * Insert berurutan (project → tiap list → batch tasks per list). Bila ada langkah
 * yang gagal, project yang terlanjur dibuat dihapus (`on delete cascade`
 * membersihkan lists/tasks) lalu error asli dilempar ulang — rollback-by-delete,
 * tanpa RPC / migrasi. `owner_id`/`created_by` selalu dari sesi, tidak dari file.
 */
export function useImportProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (raw: unknown): Promise<{ projectId: string }> => {
      const v = validateImport(raw)
      if ("errors" in v) throw new Error(v.errors.join(" "))
      const norm = normalizeImport(v.doc)

      const { data: userData, error: userError } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (userError || !uid) {
        throw new Error("Sesi tidak aktif. Login ulang lalu coba lagi.")
      }

      const { data: projectRow, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: norm.project.name,
          description: norm.project.description,
          owner_id: uid,
        })
        .select("id")
        .single()
      if (projectError || !projectRow) {
        throw projectError ?? new Error("Gagal membuat project.")
      }
      const projectId = projectRow.id

      try {
        for (const list of norm.lists) {
          const { data: listRow, error: listError } = await supabase
            .from("lists")
            .insert({
              project_id: projectId,
              name: list.name,
              position: list.position,
            })
            .select("id")
            .single()
          if (listError || !listRow) {
            throw listError ?? new Error("Gagal membuat list.")
          }

          if (list.tasks.length > 0) {
            const { error: tasksError } = await supabase.from("tasks").insert(
              list.tasks.map((task) => ({
                list_id: listRow.id,
                project_id: projectId,
                title: task.title,
                description_md: task.description_md,
                due_date: task.due_date,
                position: task.position,
                created_by: uid,
              }))
            )
            if (tasksError) throw tasksError
          }
        }
      } catch (e) {
        await supabase.from("projects").delete().eq("id", projectId)
        throw e
      }

      return { projectId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Gagal meng-import project."
      )
    },
  })
}

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export function archivedTasksKey(projectId: string) {
  return ["tasks", projectId, "archived"] as const
}

export function useArchivedTasks(projectId: string) {
  return useQuery({
    queryKey: archivedTasksKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, lists(name)")
        .eq("project_id", projectId)
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

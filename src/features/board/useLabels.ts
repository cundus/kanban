import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

export type Label = Database["public"]["Tables"]["labels"]["Row"]

function labelsKey(projectId: string) {
  return ["labels", projectId] as const
}

function taskLabelsKey(projectId: string) {
  return ["task-labels", projectId] as const
}

/**
 * Fetch all labels for a project.
 */
export function useLabels(projectId: string) {
  return useQuery({
    queryKey: labelsKey(projectId),
    queryFn: async (): Promise<Label[]> => {
      const { data, error } = await supabase
        .from("labels")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at")
      if (error) throw error
      return data as Label[]
    },
  })
}

/**
 * Create a label in a project.
 */
export function useCreateLabel(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { error } = await supabase
        .from("labels")
        .insert({ project_id: projectId, name, color })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelsKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal membuat label.")
    },
  })
}

/**
 * Update a label.
 */
export function useUpdateLabel(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      color,
    }: {
      id: string
      name: string
      color: string
    }) => {
      const { error } = await supabase
        .from("labels")
        .update({ name, color })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelsKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal mengubah label.")
    },
  })
}

/**
 * Delete a label. Cascades to invalidate task_labels.
 */
export function useDeleteLabel(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("labels")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelsKey(projectId) })
      queryClient.invalidateQueries({ queryKey: taskLabelsKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal menghapus label.")
    },
  })
}

/**
 * Batch fetch: all labels for all tasks in one project, one query pair.
 * Same dedup pattern as useTaskAssignees.
 */
export function useTaskLabels(projectId: string) {
  return useQuery({
    queryKey: taskLabelsKey(projectId),
    queryFn: async (): Promise<Record<string, Label[]>> => {
      // 1. get all task ids in this project
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId)
      if (tasksError) throw tasksError

      const taskIds = (tasks ?? []).map((t) => t.id)
      if (taskIds.length === 0) return {}

      // 2. get all task_labels rows for those tasks
      const { data: taskLabelRows, error: tlError } = await supabase
        .from("task_labels")
        .select("task_id, label_id")
        .in("task_id", taskIds)
      if (tlError) throw tlError

      // 3. get label rows for unique label_ids referenced
      const labelIds = [...new Set((taskLabelRows ?? []).map((r) => r.label_id))]
      if (labelIds.length === 0) return {}

      const { data: labels, error: labelsError } = await supabase
        .from("labels")
        .select("*")
        .in("id", labelIds)
      if (labelsError) throw labelsError

      const labelsById = new Map<string, Label>(
        (labels ?? []).map((l) => [l.id, l])
      )

      // 4. merge into Record<task_id, Label[]>
      const result: Record<string, Label[]> = {}
      for (const row of taskLabelRows ?? []) {
        const label = labelsById.get(row.label_id)
        if (!label) continue // label was deleted concurrently, skip
        const list = result[row.task_id] ?? []
        list.push(label)
        result[row.task_id] = list
      }
      return result
    },
  })
}

/**
 * Toggle one label's application on one task. Not optimistic (ponytail: upgrade
 * later if perceived latency is a problem).
 */
export function useToggleTaskLabel(taskId: string, projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      labelId,
      isCurrentlyApplied,
    }: {
      labelId: string
      isCurrentlyApplied: boolean
    }) => {
      if (isCurrentlyApplied) {
        const { error } = await supabase
          .from("task_labels")
          .delete()
          .eq("task_id", taskId)
          .eq("label_id", labelId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("task_labels")
          .insert({ task_id: taskId, label_id: labelId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskLabelsKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal mengubah label.")
    },
  })
}

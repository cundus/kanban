import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

export interface AssigneeProfile {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  email: string
}

function taskAssigneesKey(projectId: string) {
  return ["task-assignees", projectId] as const
}

/**
 * Batch fetch: all assignees for all tasks in one project, one query pair.
 * Called independently by both TaskCard and TaskDialog — same queryKey means
 * TanStack Query dedupes to a single network round trip (same pattern as
 * useMembers being called independently by MembersDialog AND TaskDialog).
 */
export function useTaskAssignees(projectId: string) {
  return useQuery({
    queryKey: taskAssigneesKey(projectId),
    queryFn: async (): Promise<Record<string, AssigneeProfile[]>> => {
      // 1. get all task ids in this project (RLS already scopes to project members)
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id")
        .eq("project_id", projectId)
      if (tasksError) throw tasksError

      const taskIds = (tasks ?? []).map((t) => t.id)
      if (taskIds.length === 0) return {}

      // 2. get all task_assignees rows for those tasks
      const { data: rows, error } = await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", taskIds)
      if (error) throw error

      // 3. get profiles for all unique user_ids
      const userIds = [...new Set((rows ?? []).map((r) => r.user_id))]
      const profilesById = new Map<
        string,
        Omit<AssigneeProfile, "user_id">
      >()
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .in("id", userIds)
        if (profilesError) throw profilesError
        for (const p of profiles ?? []) {
          profilesById.set(p.id, {
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            email: p.email,
          })
        }
      }

      // 4. merge into Record<task_id, AssigneeProfile[]>
      const result: Record<string, AssigneeProfile[]> = {}
      for (const row of rows ?? []) {
        const profile = profilesById.get(row.user_id)
        if (!profile) continue // profile row missing/deleted, skip silently
        const list = result[row.task_id] ?? []
        list.push({ user_id: row.user_id, ...profile })
        result[row.task_id] = list
      }
      return result
    },
  })
}

/**
 * Toggle one user's assignment on one task. Not optimistic (ponytail: upgrade
 * later if perceived latency is a problem — matches Fase 5's default of
 * non-optimistic mutations except useArchiveTask).
 */
export function useToggleAssignee(taskId: string, projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      isCurrentlyAssigned,
    }: {
      userId: string
      isCurrentlyAssigned: boolean
    }) => {
      if (isCurrentlyAssigned) {
        const { error } = await supabase
          .from("task_assignees")
          .delete()
          .eq("task_id", taskId)
          .eq("user_id", userId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("task_assignees")
          .insert({ task_id: taskId, user_id: userId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskAssigneesKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal mengubah assignee.")
    },
  })
}

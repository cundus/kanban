import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { positionAtEnd, positionBetween } from "./reorderUtils"
import { archivedTasksKey } from "./useArchivedTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function tasksKey(projectId: string) {
  return ["tasks", projectId] as const
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: tasksKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("position", { ascending: true })
      if (error) throw error
      return data as Task[]
    },
  })
}

export function useCreateTask(listId: string, projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; position?: number }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated")

      let nextPosition = input.position
      if (nextPosition === undefined) {
        const all = queryClient.getQueryData<Task[]>(tasksKey(projectId)) ?? []
        const inList = all.filter((t) => t.list_id === listId)
        nextPosition = positionAtEnd(inList)
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          list_id: listId,
          project_id: projectId,
          title: input.title,
          position: nextPosition,
          created_by: userData.user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
    },
  })
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      title: string
      description_md: string | null
      due_date: string | null
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: input.title,
          description_md: input.description_md,
          due_date: input.due_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
    },
  })
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
    },
  })
}

export function useDuplicateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: Task) => {
      const siblingTasks = queryClient.getQueryData<Task[]>(tasksKey(projectId)) ?? []
      const sameListTasks = siblingTasks
        .filter((t) => t.list_id === task.list_id)
        .sort((a, b) => a.position - b.position)
      const currentIndex = sameListTasks.findIndex((t) => t.id === task.id)
      const nextSibling = sameListTasks[currentIndex + 1]
      const newPosition = positionBetween(task.position, nextSibling?.position)

      const { data: userData } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          list_id: task.list_id,
          project_id: task.project_id,
          title: task.title + " (copy)",
          description_md: task.description_md,
          due_date: task.due_date,
          position: newPosition,
          created_by: userData.user!.id,
          archived_at: null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
    },
    onError: () => {
      toast.error("Gagal menduplikasi task.")
    },
  })
}

/**
 * Satu mutation untuk reorder task dalam list DAN pindah antar list.
 * Optimistic: patch cache di `onMutate`, rollback + toast di `onError`.
 */
export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient()
  const key = tasksKey(projectId)
  return useMutation({
    mutationFn: async (input: {
      taskId: string
      toListId: string
      newPosition: number
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ list_id: input.toListId, position: input.newPosition })
        .eq("id", input.taskId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Task[]>(key)
      queryClient.setQueryData<Task[]>(key, (old) =>
        (old ?? []).map((t) =>
          t.id === input.taskId
            ? { ...t, list_id: input.toListId, position: input.newPosition }
            : t
        )
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
      toast.error("Gagal memindahkan task. Perubahan dibatalkan.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useArchiveTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", taskId)
      if (error) throw error
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: tasksKey(projectId) })
      const previousTasks = queryClient.getQueryData<Task[]>(tasksKey(projectId))
      queryClient.setQueryData<Task[]>(tasksKey(projectId), (old) =>
        (old ?? []).filter((t) => t.id !== taskId)
      )
      return { previousTasks }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(tasksKey(projectId), context.previousTasks)
      }
      toast.error("Gagal mengarsipkan task. Perubahan dibatalkan.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
      queryClient.invalidateQueries({ queryKey: archivedTasksKey(projectId) })
    },
  })
}

export function useRestoreTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ archived_at: null })
        .eq("id", taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(projectId) })
      queryClient.invalidateQueries({ queryKey: archivedTasksKey(projectId) })
      toast.success("Task dipulihkan.")
    },
    onError: () => {
      toast.error("Gagal memulihkan task.")
    },
  })
}

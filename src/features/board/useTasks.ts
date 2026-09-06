import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { positionAtEnd } from "./reorderUtils"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

function tasksKey(projectId: string) {
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
        .order("position", { ascending: true })
      if (error) throw error
      return data as Task[]
    },
  })
}

export function useCreateTask(listId: string, projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated")

      const all = queryClient.getQueryData<Task[]>(tasksKey(projectId)) ?? []
      const inList = all.filter((t) => t.list_id === listId)
      const nextPosition = positionAtEnd(inList)

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          list_id: listId,
          project_id: projectId,
          title,
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

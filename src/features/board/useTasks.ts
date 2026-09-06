import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { swapPosition } from "./reorderUtils"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

function tasksKey(listId: string) {
  return ["tasks", listId] as const
}

export function useTasks(listId: string) {
  return useQuery({
    queryKey: tasksKey(listId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("list_id", listId)
        .order("position", { ascending: true })
      if (error) throw error
      return data as Task[]
    },
  })
}

export function useCreateTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const { data: listRow, error: listError } = await supabase
        .from("lists")
        .select("project_id")
        .eq("id", listId)
        .single()
      if (listError) throw listError

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated")

      const existing = queryClient.getQueryData<Task[]>(tasksKey(listId)) ?? []
      const nextPosition = existing.length > 0 ? Math.max(...existing.map((t) => t.position)) + 1 : 0

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          list_id: listId,
          project_id: listRow.project_id,
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
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

export function useUpdateTask(listId: string) {
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
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

export function useDeleteTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

export function useReorderTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; direction: "up" | "down" }) => {
      const tasks = queryClient.getQueryData<Task[]>(tasksKey(listId)) ?? []
      const index = tasks.findIndex((t) => t.id === input.taskId)
      const swapped = swapPosition(tasks, index, input.direction)
      if (!swapped) return

      const [a, b] = swapped
      const { error } = await supabase.from("tasks").upsert([a, b])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { swapPosition } from "./reorderUtils"

type List = Database["public"]["Tables"]["lists"]["Row"]

function listsKey(projectId: string) {
  return ["lists", projectId] as const
}

export function useLists(projectId: string) {
  return useQuery({
    queryKey: listsKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
      if (error) throw error
      return data as List[]
    },
  })
}

export function useCreateList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const existing = queryClient.getQueryData<List[]>(listsKey(projectId)) ?? []
      const nextPosition = existing.length > 0 ? Math.max(...existing.map((l) => l.position)) + 1 : 0

      const { data, error } = await supabase
        .from("lists")
        .insert({ project_id: projectId, name, position: nextPosition })
        .select()
        .single()
      if (error) throw error
      return data as List
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

export function useRenameList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from("lists")
        .update({ name: input.name })
        .eq("id", input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

export function useDeleteList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lists").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

export function useReorderList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { listId: string; direction: "up" | "down" }) => {
      const lists = queryClient.getQueryData<List[]>(listsKey(projectId)) ?? []
      const index = lists.findIndex((l) => l.id === input.listId)
      const swapped = swapPosition(lists, index, input.direction)
      if (!swapped) return

      const [a, b] = swapped
      const { error } = await supabase.from("lists").upsert([a, b])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

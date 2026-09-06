import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

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

/**
 * Reorder list secara optimistic: patch `position` di cache pada `onMutate`,
 * rollback snapshot + toast pada `onError`.
 */
export function useReorderList(projectId: string) {
  const queryClient = useQueryClient()
  const key = listsKey(projectId)
  return useMutation({
    mutationFn: async (input: { listId: string; newPosition: number }) => {
      const { error } = await supabase
        .from("lists")
        .update({ position: input.newPosition })
        .eq("id", input.listId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<List[]>(key)
      queryClient.setQueryData<List[]>(key, (old) =>
        (old ?? []).map((l) =>
          l.id === input.listId ? { ...l, position: input.newPosition } : l
        )
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous)
      toast.error("Gagal mengurutkan list. Perubahan dibatalkan.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

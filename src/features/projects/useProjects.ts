import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

const PROJECTS_KEY = ["projects"] as const

export type ProjectWithRole = Project & { isOwner: boolean }

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async (): Promise<ProjectWithRole[]> => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null

      // RLS baru mengembalikan project milik sendiri + yang dibagikan.
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error

      const rows = (data as Project[]).map((project) => ({
        ...project,
        isOwner: project.owner_id === uid,
      }))
      // Owned dulu, lalu shared; tie-break created_at desc.
      rows.sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1
        return b.created_at.localeCompare(a.created_at)
      })
      return rows
    },
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single()
      if (error) throw error
      return data as Project
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description: string | null }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated")

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: input.name,
          description: input.description,
          owner_id: userData.user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; description: string | null }) => {
      const { data, error } = await supabase
        .from("projects")
        .update({ name: input.name, description: input.description })
        .eq("id", input.id)
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}

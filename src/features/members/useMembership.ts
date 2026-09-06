import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export type ProjectRole = "owner" | "member"

export function membershipKey(projectId: string) {
  return ["membership", projectId] as const
}

/**
 * Role user saat ini untuk sebuah project (dari `project_members`).
 * `null` bila user bukan anggota accepted (atau belum login).
 */
export function useMembership(projectId: string) {
  return useQuery({
    queryKey: membershipKey(projectId),
    queryFn: async (): Promise<{ role: ProjectRole | null }> => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) return { role: null }

      const { data, error } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", uid)
        .eq("status", "accepted")
        .maybeSingle()
      if (error) throw error

      return { role: data?.role ?? null }
    },
  })
}

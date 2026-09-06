import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

type MemberBase = Database["public"]["Tables"]["project_members"]["Row"]

export interface MemberRow extends MemberBase {
  profile: {
    full_name: string | null
    avatar_url: string | null
    email: string
  } | null
}

function membersKey(projectId: string) {
  return ["members", projectId] as const
}

/**
 * Daftar member sebuah project + profil (nama/avatar/email) untuk baris yang
 * sudah punya `user_id`. Dua query lalu digabung di client — types RLS helper
 * belum punya relasi FK untuk embed PostgREST.
 */
export function useMembers(projectId: string) {
  return useQuery({
    queryKey: membersKey(projectId),
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: members, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
      if (error) throw error

      const rows = members ?? []
      const userIds = [
        ...new Set(
          rows
            .map((m) => m.user_id)
            .filter((id): id is string => id !== null)
        ),
      ]

      const profilesById = new Map<string, MemberRow["profile"]>()
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

      return rows.map((m) => ({
        ...m,
        profile: m.user_id ? profilesById.get(m.user_id) ?? null : null,
      }))
    },
  })
}

/** Owner mengundang member baru lewat email (baris pending). */
export function useInviteMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        invited_email: email.trim().toLowerCase(),
        role: "member",
        status: "pending",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(projectId) })
      toast.success("Undangan dibuat. Bagikan link-nya ke orang tersebut.")
    },
    onError: (error) => {
      const code = (error as { code?: string }).code
      toast.error(
        code === "23505"
          ? "Email itu sudah diundang ke project ini."
          : "Gagal mengundang member."
      )
    },
  })
}

/** Owner menghapus member / membatalkan undangan (by row id). */
export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (memberRowId: string) => {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberRowId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey(projectId) })
      toast.success("Member dihapus dari project.")
    },
    onError: () => toast.error("Gagal menghapus member."),
  })
}

/** Member keluar dari project (menghapus baris keanggotaannya sendiri). */
export function useLeaveProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", uid)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: membersKey(projectId) })
      queryClient.invalidateQueries({ queryKey: ["membership", projectId] })
    },
    onError: () => toast.error("Gagal keluar dari project."),
  })
}

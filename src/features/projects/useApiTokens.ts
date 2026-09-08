import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

export type ApiToken = Database["public"]["Tables"]["mcp_tokens"]["Row"]

function apiTokensKey(userId: string) {
  return ["mcp-tokens", userId] as const
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `kbn_${hex}`
}

export function useApiTokens(userId: string) {
  return useQuery({
    queryKey: apiTokensKey(userId),
    queryFn: async (): Promise<ApiToken[]> => {
      const { data, error } = await supabase.from("mcp_tokens").select("*").eq("user_id", userId).order("created_at")
      if (error) throw error
      return data as ApiToken[]
    },
  })
}

export function useCreateApiToken(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      const rawToken = generateRawToken()
      const tokenHash = await sha256Hex(rawToken)
      const { error } = await supabase.from("mcp_tokens").insert({ user_id: userId, name, token_hash: tokenHash })
      if (error) throw error
      return rawToken
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: apiTokensKey(userId) }) },
    onError: () => { toast.error("Gagal membuat token.") },
  })
}

export function useRevokeApiToken(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mcp_tokens").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: apiTokensKey(userId) }) },
    onError: () => { toast.error("Gagal mencabut token.") },
  })
}

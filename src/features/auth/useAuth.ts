import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

// Klaim undangan cukup sekali per user per sesi tab. StrictMode men-double-mount
// effect dan `onAuthStateChange` bisa memancarkan SIGNED_IN berulang (refresh
// token, fokus tab) — guard modul ini mencegah RPC dobel.
let claimAttemptedForUser: string | null = null

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    function claimPendingInvites(userId: string) {
      if (claimAttemptedForUser === userId) return
      claimAttemptedForUser = userId
      supabase.rpc("claim_pending_invites").then(({ data, error }) => {
        if (error) {
          claimAttemptedForUser = null
          return
        }
        if (typeof data === "number" && data > 0) {
          queryClient.invalidateQueries({ queryKey: ["projects"] })
        }
      })
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
      // Tangani reload setelah redirect OAuth: sesi sudah ada tanpa event.
      if (data.session?.user) claimPendingInvites(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession)
        if (event === "SIGNED_IN" && newSession?.user) {
          claimPendingInvites(newSession.user.id)
        }
        if (event === "SIGNED_OUT") {
          claimAttemptedForUser = null
        }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [queryClient])

  function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }

  function signOut() {
    return supabase.auth.signOut()
  }

  return { session, isLoading, signInWithGoogle, signOut }
}

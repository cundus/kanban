import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./useAuth"

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

import { Button } from "@/components/ui/button"
import { useAuth } from "./useAuth"

export function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Personal Kanban</h1>
      <Button onClick={() => signInWithGoogle()}>Login with Google</Button>
    </div>
  )
}

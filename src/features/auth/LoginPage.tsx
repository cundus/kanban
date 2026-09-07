import { useState } from "react"
import { KanbanSquareIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { GoogleIcon } from "./GoogleIcon"
import { useAuth } from "./useAuth"

const HIGHLIGHTS = [
  {
    icon: KanbanSquareIcon,
    title: "Boards that stay yours",
    body: "Lists, tasks, and due dates without the ceremony of a team tool.",
  },
  {
    icon: SparklesIcon,
    title: "Fast by default",
    body: "Drag, drop, and edit inline. Changes land before you finish blinking.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Private unless you share",
    body: "Invite by email when you want company. Everything else stays closed.",
  },
]

export function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)

  async function handleSignIn() {
    setIsSigningIn(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setIsSigningIn(false)
      toast.error("Gagal masuk dengan Google. Coba lagi.")
    }
    // On success the browser redirects, so the pending state is never cleared.
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent-soft blur-[120px] lg:left-1/4"
      />

      <header className="relative mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-accent-solid" />
          <span className="text-ui text-text-2">Personal kanban</span>
        </div>
        <ThemeToggle />
      </header>

      <main
        id="main"
        className="relative mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-16"
      >
        <section className="animate-enter flex flex-col gap-6">
          <span className="w-fit rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-micro text-accent-solid">
            Built for one focused person
          </span>

          <div className="flex flex-col gap-3">
            <h1 className="text-display text-text-1">
              The work you actually track, in one board.
            </h1>
            <p className="max-w-[52ch] text-body text-text-3">
              Boards, lists, and tasks without the sprawl of a project suite.
              Sign in and pick up where you left off.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-accent-solid">
                  <Icon size={16} strokeWidth={1.5} aria-hidden />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-ui text-text-1">{title}</p>
                  <p className="max-w-[46ch] text-label text-text-3">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="signin-heading"
          className="animate-enter flex flex-col gap-6 rounded-xl border border-line bg-surface-2 p-6 sm:p-8 lg:max-w-sm lg:justify-self-end"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex flex-col gap-2">
            <h2 id="signin-heading" className="text-heading text-text-1">
              Sign in
            </h2>
            <p className="text-label text-text-3">
              Google is the only way in. No password to forget, no inbox to
              verify.
            </p>
          </div>

          <Button
            size="lg"
            variant="outline"
            className="w-full justify-center gap-3"
            onClick={handleSignIn}
            disabled={isSigningIn}
          >
            <GoogleIcon />
            {isSigningIn ? "Opening Google..." : "Continue with Google"}
          </Button>

          <p className="text-micro text-text-3">
            We read your name and email to label your boards. Nothing else.
          </p>
        </section>
      </main>
    </div>
  )
}

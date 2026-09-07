import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { useTheme } from "@/lib/theme"

/** DESIGN.md 5.8 — aria-label names the action, not the current state. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === "dark" ? "light" : "dark"

  return (
    <Tooltip label={`Switch to ${nextTheme} theme`}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full text-text-3 hover:text-text-1"
        onClick={toggleTheme}
        aria-label={`Switch to ${nextTheme} theme`}
      >
        {theme === "dark" ? (
          <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </Button>
    </Tooltip>
  )
}

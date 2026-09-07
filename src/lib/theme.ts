import { useCallback, useSyncExternalStore } from "react"

/**
 * Theme state lives on <html class="dark">, seeded before first paint by the
 * inline script in index.html. This hook only mirrors and mutates it.
 * See DESIGN.md 5.8.
 */

const STORAGE_KEY = "pk-theme"

export type Theme = "dark" | "light"

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark")
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Private mode: the class still applied, it just won't survive a reload.
  }
  for (const listener of listeners) listener()
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "dark" as const)
  const toggleTheme = useCallback(() => {
    applyTheme(getSnapshot() === "dark" ? "light" : "dark")
  }, [])
  return { theme, toggleTheme }
}

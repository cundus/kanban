import { supabase } from "./db.js"

const KEEPALIVE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

export function startKeepalive(): void {
  setInterval(() => {
    supabase
      .from("projects")
      .select("id")
      .limit(1)
      .then(({ error }) => {
        if (error) console.error("[keepalive] ping failed:", error.message)
        else console.log("[keepalive] ping ok:", new Date().toISOString())
      })
  }, KEEPALIVE_INTERVAL_MS)
}

import { supabase } from "./db.js"

const KEEPALIVE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

export function startKeepalive(): void {
  setInterval(() => {
    Promise.resolve(supabase.from("projects").select("id").limit(1))
      .then(({ error }) => {
        if (error) console.error("[keepalive] ping failed:", error.message)
        else console.log("[keepalive] ping ok:", new Date().toISOString())
      })
      .catch((err: unknown) => {
        console.error("[keepalive] ping threw:", err)
      })
  }, KEEPALIVE_INTERVAL_MS)
}

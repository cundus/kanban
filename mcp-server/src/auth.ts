import { createHash } from "node:crypto"
import type { MiddlewareHandler } from "hono"
import { supabase } from "./db.js"

declare module "hono" {
  interface ContextVariableMap {
    userId: string
  }
}

const RATE_LIMIT_MAX_REQUESTS = 60
const RATE_LIMIT_WINDOW_MS = 60_000

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX_REQUESTS
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401)
  }

  const token = authHeader.slice("Bearer ".length)
  const tokenHash = createHash("sha256").update(token).digest("hex")

  if (isRateLimited(tokenHash)) {
    return c.json({ error: "Rate limit exceeded" }, 429)
  }

  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error) {
    return c.json({ error: "Internal server error" }, 500)
  }

  if (!data) {
    return c.json({ error: "Invalid token" }, 401)
  }

  c.set("userId", data.user_id)

  void supabase
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: updateError }) => {
      if (updateError) {
        console.error("Failed to update mcp_tokens.last_used_at:", updateError.message)
      }
    })

  await next()
}

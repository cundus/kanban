import { serve, type HttpBindings } from "@hono/node-server"
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response"
import { Hono } from "hono"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { authMiddleware } from "./auth.js"
import { registerProjectTools } from "./tools/project.js"
import { registerListTools } from "./tools/list.js"
import { registerLabelTools } from "./tools/label.js"
import { registerTaskTools } from "./tools/task.js"
import { startKeepalive } from "./keepalive.js"

process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason))
process.on("uncaughtException", (err) => console.error("uncaughtException:", err))

const rawPort = Number(process.env.PORT ?? 3100)
const PORT = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3100

const app = new Hono<{ Bindings: HttpBindings }>()

app.get("/health", (c) => c.json({ status: "ok" }))

app.post("/mcp", authMiddleware, async (c) => {
  try {
    const userId = c.get("userId")

    const server = new McpServer({ name: "kanban-mcp-server", version: "1.0.0" })
    registerProjectTools(server, userId)
    registerListTools(server, userId)
    registerLabelTools(server, userId)
    registerTaskTools(server, userId)

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    c.env.outgoing.on("close", () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    await transport.handleRequest(c.env.incoming, c.env.outgoing, body)

    return RESPONSE_ALREADY_SENT
  } catch (err) {
    console.error("mcp handler error:", err instanceof Error ? err.message : err)
    if (!c.env.outgoing.headersSent) {
      return c.json({ error: "Internal server error" }, 500)
    }
    return RESPONSE_ALREADY_SENT
  }
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`kanban-mcp-server listening on port ${info.port}`)
  startKeepalive()
})

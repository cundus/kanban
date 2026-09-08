import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase, assertProjectMember, McpError } from "../db.js"

export function registerLabelTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_labels",
    {
      description: "List all labels defined in a project.",
      inputSchema: { project_id: z.string().uuid() },
    },
    async ({ project_id }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        if (!(err instanceof McpError)) console.error(err)
        const message = err instanceof McpError ? err.message : "Unexpected error"
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true }
      }

      const { data, error } = await supabase
        .from("labels")
        .select("id, name, color")
        .eq("project_id", project_id)
        .order("created_at")

      if (error) {
        console.error("list_labels DB error:", error.message)
        return { content: [{ type: "text", text: "Error: Failed to list labels" }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    }
  )
}

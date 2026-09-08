import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase, assertProjectMember, McpError } from "../db.js"

export function registerListTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_lists",
    {
      description: "List all columns (lists) in a project.",
      inputSchema: { project_id: z.string().uuid() },
    },
    async ({ project_id }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        const message = err instanceof McpError ? err.message : "Unexpected error"
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true }
      }

      const { data, error } = await supabase
        .from("lists")
        .select("id, name, position")
        .eq("project_id", project_id)
        .order("position")

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    }
  )
}

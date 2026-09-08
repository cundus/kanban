import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase } from "../db.js"

export function registerProjectTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_projects",
    {
      description: "List all kanban projects the current user is a member of.",
      inputSchema: {},
    },
    async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, projects(id, name, description)")
        .eq("user_id", userId)
        .eq("status", "accepted")

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }

      const projects = (data ?? []).map((row) => row.projects)
      return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] }
    }
  )
}

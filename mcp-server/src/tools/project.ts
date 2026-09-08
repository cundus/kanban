import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase } from "../db.js"

interface ProjectMemberRow {
  project_id: string
  projects: { id: string; name: string; description: string | null } | null
}

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
        .returns<ProjectMemberRow[]>()

      if (error) {
        console.error("list_projects DB error:", error.message)
        return { content: [{ type: "text", text: "Error: Failed to list projects" }], isError: true }
      }

      const projects = (data ?? [])
        .map((row) => row.projects)
        .filter((p): p is NonNullable<typeof p> => p !== null)
      return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] }
    }
  )
}

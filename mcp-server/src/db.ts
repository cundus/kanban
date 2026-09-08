import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../src/types/database.types.js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
}

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey)

export class McpError extends Error {}

export async function assertProjectMember(userId: string, projectId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_project_member_for_user", {
    p_user_id: userId,
    p_project_id: projectId,
  })
  if (error || !data) throw new McpError("Not a member of this project")
}

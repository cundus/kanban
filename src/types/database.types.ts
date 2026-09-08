// ponytail: hand-written types, ceiling = drift from real schema if migrations change without updating this file. lists.position and tasks.position are `double precision` (fractional index) as of migration 20260906010000_fractional_positions; still mapped to `number` here. As of migration 20260906020000_project_members_rls (Fase 3): adds the `project_members` table and the RLS helper functions `is_project_member` / `is_project_owner` / `shares_project_with` / `claim_pending_invites`. As of migration 20260908010000_task_assignees (Fase 6.1): adds the task_assignees join table. As of migration 20260908020000_labels (Fase 6.2): adds labels and task_labels tables. As of migration 20260908030000_mcp_tokens (MCP Server): adds the mcp_tokens table and the is_project_member_for_user(p_user_id, p_project_id) RLS helper function. Upgrade: once Supabase CLI is linked to the project, replace with `supabase gen types typescript --project-id <ref> > src/types/database.types.ts`.

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: {
      is_project_member: { Args: { p_project: string }; Returns: boolean }
      is_project_owner: { Args: { p_project: string }; Returns: boolean }
      shares_project_with: { Args: { p_user: string }; Returns: boolean }
      claim_pending_invites: { Args: Record<string, never>; Returns: number }
      is_project_member_for_user: { Args: { p_user_id: string; p_project_id: string }; Returns: boolean }
    }
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
        }
        Relationships: []
      }
      lists: {
        Row: {
          id: string
          project_id: string
          name: string
          position: number
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          position: number
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string | null
          invited_email: string
          role: "owner" | "member"
          status: "pending" | "accepted"
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id?: string | null
          invited_email: string
          role?: "owner" | "member"
          status?: "pending" | "accepted"
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string | null
          invited_email?: string
          role?: "owner" | "member"
          status?: "pending" | "accepted"
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          list_id: string
          project_id: string
          title: string
          description_md: string | null
          due_date: string | null
          position: number
          created_by: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          list_id: string
          project_id: string
          title: string
          description_md?: string | null
          due_date?: string | null
          position: number
          created_by: string
          updated_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          list_id?: string
          project_id?: string
          title?: string
          description_md?: string | null
          due_date?: string | null
          position?: number
          created_by?: string
          updated_at?: string
          archived_at?: string | null
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          task_id: string
          user_id: string
          assigned_at: string
        }
        Insert: {
          task_id: string
          user_id: string
          assigned_at?: string
        }
        Update: {
          task_id?: string
          user_id?: string
          assigned_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          id: string
          project_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          color?: string
          created_at?: string
        }
        Relationships: []
      }
      task_labels: {
        Row: {
          task_id: string
          label_id: string
        }
        Insert: {
          task_id: string
          label_id: string
        }
        Update: {
          task_id?: string
          label_id?: string
        }
        Relationships: []
      }
      mcp_tokens: {
        Row: {
          id: string
          user_id: string
          token_hash: string
          name: string
          created_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token_hash: string
          name: string
          created_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token_hash?: string
          name?: string
          created_at?: string
          last_used_at?: string | null
        }
        Relationships: []
      }
    }
  }
}

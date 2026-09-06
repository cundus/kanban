// ponytail: hand-written types, ceiling = drift from real schema if migrations change without updating this file. Upgrade: once Supabase CLI is linked to the project, replace with `supabase gen types typescript --project-id <ref> > src/types/database.types.ts`.

export interface Database {
  public: {
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
        }
      }
    }
  }
}

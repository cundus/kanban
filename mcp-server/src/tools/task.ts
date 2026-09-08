import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase, assertProjectMember, McpError } from "../db.js"

// ponytail: delete-then-insert isn't atomic; upgrade to a Postgres RPC/transaction if partial-write races become a real problem
async function replaceAssignee(taskId: string, assigneeId: string | null | undefined): Promise<void> {
  if (assigneeId === undefined) return // field not provided, leave untouched
  const { error: delError } = await supabase.from("task_assignees").delete().eq("task_id", taskId)
  if (delError) throw new Error(`Failed to clear assignee: ${delError.message}`)
  if (assigneeId === null) return // explicit unassign
  const { error: insError } = await supabase
    .from("task_assignees")
    .insert({ task_id: taskId, user_id: assigneeId })
  if (insError) throw new Error(`Failed to set assignee: ${insError.message}`)
}

// ponytail: delete-then-insert isn't atomic; upgrade to a Postgres RPC/transaction if partial-write races become a real problem
async function replaceLabels(taskId: string, labelIds: string[] | undefined): Promise<void> {
  if (labelIds === undefined) return // field not provided, leave untouched
  const { error: delError } = await supabase.from("task_labels").delete().eq("task_id", taskId)
  if (delError) throw new Error(`Failed to clear labels: ${delError.message}`)
  if (labelIds.length === 0) return
  const rows = labelIds.map((labelId) => ({ task_id: taskId, label_id: labelId }))
  const { error: insError } = await supabase.from("task_labels").insert(rows)
  if (insError) throw new Error(`Failed to set labels: ${insError.message}`)
}

async function validateListInProject(listId: string, projectId: string): Promise<string | null> {
  const { data, error } = await supabase.from("lists").select("project_id").eq("id", listId).single()
  if (error) {
    console.error("validateListInProject DB error:", error.message)
    return "Error: failed to validate list_id"
  }
  if (data.project_id !== projectId) return "Error: list_id does not belong to this project"
  return null
}

async function validateAssigneeInProject(assigneeId: string, projectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", assigneeId)
    .eq("status", "accepted")
    .maybeSingle()
  if (error) {
    console.error("validateAssigneeInProject DB error:", error.message)
    return "Error: failed to validate assignee_id"
  }
  if (!data) return "Error: assignee_id is not a member of this project"
  return null
}

async function validateLabelsInProject(labelIds: string[], projectId: string): Promise<string | null> {
  const { data, error } = await supabase.from("labels").select("id").eq("project_id", projectId).in("id", labelIds)
  if (error) {
    console.error("validateLabelsInProject DB error:", error.message)
    return "Error: failed to validate label_ids"
  }
  const foundIds = new Set(data.map((label) => label.id))
  const allFound = labelIds.every((id) => foundIds.has(id))
  if (!allFound) return "Error: one or more label_ids do not belong to this project"
  return null
}

export function registerTaskTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_tasks",
    {
      description: "List tasks in a project, optionally filtered by list.",
      inputSchema: {
        project_id: z.string().uuid(),
        list_id: z.string().uuid().optional(),
      },
    },
    async ({ project_id, list_id }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        if (!(err instanceof McpError)) console.error(err)
        const message = err instanceof McpError ? err.message : "Unexpected error"
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true }
      }

      let query = supabase
        .from("tasks")
        .select("id, list_id, title, description_md, due_date, position, archived_at")
        .eq("project_id", project_id)
        .is("archived_at", null)
        .order("position")

      if (list_id) query = query.eq("list_id", list_id)

      const { data, error } = await query

      if (error) {
        console.error("list_tasks DB error:", error.message)
        return { content: [{ type: "text", text: "Error: failed to fetch tasks" }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.registerTool(
    "create_task",
    {
      description: "Create a new task in a project list.",
      inputSchema: {
        project_id: z.string().uuid(),
        list_id: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        due_date: z.string().datetime().optional(),
        position: z.number(),
        assignee_id: z.string().uuid().optional(),
        label_ids: z.array(z.string().uuid()).optional(),
      },
    },
    async ({ project_id, list_id, title, description, due_date, position, assignee_id, label_ids }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        if (!(err instanceof McpError)) console.error(err)
        const message = err instanceof McpError ? err.message : "Unexpected error"
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true }
      }

      const listError = await validateListInProject(list_id, project_id)
      if (listError) return { content: [{ type: "text", text: listError }], isError: true }

      if (assignee_id) {
        const assigneeError = await validateAssigneeInProject(assignee_id, project_id)
        if (assigneeError) return { content: [{ type: "text", text: assigneeError }], isError: true }
      }

      if (label_ids && label_ids.length > 0) {
        const labelError = await validateLabelsInProject(label_ids, project_id)
        if (labelError) return { content: [{ type: "text", text: labelError }], isError: true }
      }

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          project_id,
          list_id,
          title,
          description_md: description ?? null,
          due_date: due_date ?? null,
          position,
          created_by: userId,
        })
        .select("id")
        .single()

      if (error || !task) {
        console.error("create_task DB error:", error?.message)
        return { content: [{ type: "text", text: "Error: failed to create task" }], isError: true }
      }

      try {
        await replaceAssignee(task.id, assignee_id)
        await replaceLabels(task.id, label_ids)
      } catch (err) {
        console.error(err)
        return {
          content: [{ type: "text", text: `Task created (id: ${task.id}) but failed to set assignee/labels` }],
          isError: true,
        }
      }

      return { content: [{ type: "text", text: JSON.stringify({ id: task.id }, null, 2) }] }
    }
  )

  server.registerTool(
    "update_task",
    {
      description: "Update fields on an existing task.",
      inputSchema: {
        task_id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        list_id: z.string().uuid().optional(),
        position: z.number().optional(),
        due_date: z.string().datetime().nullable().optional(),
        assignee_id: z.string().uuid().nullable().optional(),
        label_ids: z.array(z.string().uuid()).optional(),
      },
    },
    async ({ task_id, title, description, list_id, position, due_date, assignee_id, label_ids }) => {
      const { data: existingTask, error: fetchError } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", task_id)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("update_task lookup DB error:", fetchError.message)
        return { content: [{ type: "text", text: "Error: failed to lookup task" }], isError: true }
      }
      if (!existingTask) {
        return { content: [{ type: "text", text: "Error: task not found" }], isError: true }
      }

      try {
        await assertProjectMember(userId, existingTask.project_id)
      } catch (err) {
        if (!(err instanceof McpError)) console.error(err)
        const message = err instanceof McpError ? err.message : "Unexpected error"
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true }
      }

      if (list_id !== undefined) {
        const listError = await validateListInProject(list_id, existingTask.project_id)
        if (listError) return { content: [{ type: "text", text: listError }], isError: true }
      }

      if (assignee_id) {
        const assigneeError = await validateAssigneeInProject(assignee_id, existingTask.project_id)
        if (assigneeError) return { content: [{ type: "text", text: assigneeError }], isError: true }
      }

      if (label_ids && label_ids.length > 0) {
        const labelError = await validateLabelsInProject(label_ids, existingTask.project_id)
        if (labelError) return { content: [{ type: "text", text: labelError }], isError: true }
      }

      const updates: {
        title?: string
        description_md?: string | null
        list_id?: string
        position?: number
        due_date?: string | null
      } = {}
      if (title !== undefined) updates.title = title
      if (description !== undefined) updates.description_md = description
      if (list_id !== undefined) updates.list_id = list_id
      if (position !== undefined) updates.position = position
      if (due_date !== undefined) updates.due_date = due_date

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("tasks").update(updates).eq("id", task_id)
        if (error) {
          console.error("update_task DB error:", error.message)
          return { content: [{ type: "text", text: "Error: failed to update task" }], isError: true }
        }
      }

      try {
        await replaceAssignee(task_id, assignee_id)
        await replaceLabels(task_id, label_ids)
      } catch (err) {
        console.error(err)
        return {
          content: [{ type: "text", text: "Error: task updated but failed to update assignee/labels" }],
          isError: true,
        }
      }

      return { content: [{ type: "text", text: JSON.stringify({ id: task_id, updated: true }, null, 2) }] }
    }
  )

  server.registerTool(
    "delete_task",
    {
      description: "Delete a task.",
      inputSchema: { task_id: z.string().uuid() },
    },
    async ({ task_id }) => {
      const { data: existingTask, error: fetchError } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", task_id)
        .single()

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("delete_task lookup DB error:", fetchError.message)
        return { content: [{ type: "text", text: "Error: failed to lookup task" }], isError: true }
      }
      if (!existingTask) {
        return { content: [{ type: "text", text: "Error: task not found" }], isError: true }
      }

      try {
        await assertProjectMember(userId, existingTask.project_id)
      } catch (err) {
        if (!(err instanceof McpError)) console.error(err)
        const message = err instanceof McpError ? err.message : "Unexpected error"
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true }
      }

      const { error } = await supabase.from("tasks").delete().eq("id", task_id)
      if (error) {
        console.error("delete_task DB error:", error.message)
        return { content: [{ type: "text", text: "Error: failed to delete task" }], isError: true }
      }

      return { content: [{ type: "text", text: JSON.stringify({ id: task_id, deleted: true }, null, 2) }] }
    }
  )
}

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "./MarkdownEditor"
import { renderMarkdown } from "./markdown"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Database } from "@/types/database.types"
import { useDeleteTask, useUpdateTask } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
}: {
  task: Task | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)

  const [isEditing, setIsEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [descriptionMd, setDescriptionMd] = useState("")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescriptionMd(task.description_md ?? "")
      setDueDate(task.due_date ?? "")
      setIsEditing(false)
    }
  }, [task])

  if (!task) return null

  function handleSave() {
    if (!task) return
    updateTask.mutate(
      {
        id: task.id,
        title,
        description_md: descriptionMd || null,
        due_date: dueDate || null,
      },
      { onSuccess: () => setIsEditing(false) }
    )
  }

  function handleDelete() {
    if (!task) return
    deleteTask.mutate(task.id, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          {isEditing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <DialogTitle>{task.title}</DialogTitle>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-due-date">Due date</Label>
            {isEditing ? (
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            ) : (
              <p className="text-ui text-text-2" data-numeric>
                {task.due_date ?? "No due date"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            {isEditing ? (
              <MarkdownEditor value={descriptionMd} onChange={setDescriptionMd} />
            ) : task.description_md ? (
              <div
                className="max-w-[65ch] text-ui text-text-2"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(task.description_md) }}
              />
            ) : (
              <p className="text-ui text-text-3">No description</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete task
          </Button>
          {isEditing ? (
            <Button onClick={handleSave}>Save</Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </DialogFooter>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete ${task.title}?`}
          description="This task and its description are removed. This cannot be undone."
          onConfirm={handleDelete}
        />
      </DialogContent>
    </Dialog>
  )
}

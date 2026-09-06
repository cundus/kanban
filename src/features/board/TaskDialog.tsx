import { useEffect, useState } from "react"
import { marked } from "marked"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  listId,
  open,
  onOpenChange,
}: {
  task: Task | null
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateTask = useUpdateTask(listId)
  const deleteTask = useDeleteTask(listId)

  const [isEditing, setIsEditing] = useState(false)
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

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Due date</label>
            {isEditing ? (
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            ) : (
              <p className="text-sm">{task.due_date ?? "No due date"}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Description</label>
            {isEditing ? (
              <Textarea
                rows={8}
                value={descriptionMd}
                onChange={(e) => setDescriptionMd(e.target.value)}
                placeholder="Markdown supported"
              />
            ) : task.description_md ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: marked.parse(task.description_md) as string }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No description</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleDelete}>
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
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog"
import { MarkdownEditor } from "./MarkdownEditor"
import { TaskActionsMenu } from "./TaskActionsMenu"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { Database } from "@/types/database.types"
import { useMembers } from "@/features/members/useMembers"
import { useUpdateTask } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

const TITLE_INPUT_ID = "task-dialog-title"

export function TaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
  autoFocusTitle,
}: {
  task: Task | null
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  autoFocusTitle?: boolean
}) {
  const [title, setTitle] = useState("")
  const [descriptionMd, setDescriptionMd] = useState("")
  const [descriptionDirty, setDescriptionDirty] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const updateTask = useUpdateTask(projectId)
  const { data: members } = useMembers(projectId)

  // Reset on task identity change only — not full object — so an in-flight
  // autosave that updates the cached task object doesn't reset these fields
  // mid-edit.
  const taskId = task?.id
  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescriptionMd(task.description_md ?? "")
    setDescriptionDirty(false)
    setDueDate(task.due_date ?? "")
  }, [taskId])

  useEffect(() => {
    if (!open || !autoFocusTitle) return
    const el = document.getElementById(TITLE_INPUT_ID) as HTMLInputElement | null
    if (el) {
      el.focus()
      el.select()
    }
  }, [open, autoFocusTitle])

  if (!task) return null
  const currentTask = task

  const handleTitleBlur = () => {
    const trimmed = title.trim()
    if (trimmed === "" || trimmed === currentTask.title) {
      setTitle(currentTask.title)
      return
    }
    updateTask.mutate(
      { id: currentTask.id, title: trimmed },
      {
        onError: () => {
          setTitle(currentTask.title)
          toast.error("Gagal menyimpan judul.")
        },
      }
    )
  }

  const handleDueDateBlur = () => {
    if (dueDate === (currentTask.due_date ?? "")) return
    updateTask.mutate(
      { id: currentTask.id, due_date: dueDate || null },
      {
        onError: () => {
          setDueDate(currentTask.due_date ?? "")
          toast.error("Gagal menyimpan tanggal.")
        },
      }
    )
  }

  const handleDescriptionSave = () => {
    updateTask.mutate(
      { id: currentTask.id, description_md: descriptionMd || null },
      {
        onSuccess: () => setDescriptionDirty(false),
        onError: () => toast.error("Gagal menyimpan deskripsi."),
      }
    )
  }

  const creator = members?.find((m) => m.user_id === currentTask.created_by)
  const creatorName = creator?.profile?.full_name ?? creator?.profile?.email ?? "—"
  const updatedRelative = formatRelativeTime(currentTask.updated_at)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <Input
            id={TITLE_INPUT_ID}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="text-heading border-none px-0 shadow-none focus-visible:ring-0"
          />
          <TaskActionsMenu
            task={currentTask}
            projectId={projectId}
            variant="dropdown"
            disableRename
            onRename={() => {}}
          />
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
          <div className="flex flex-col gap-2 md:order-1">
            <Label>Description</Label>
            <MarkdownEditor
              value={descriptionMd}
              onChange={(v) => {
                setDescriptionMd(v)
                setDescriptionDirty(true)
              }}
            />
            {descriptionDirty && (
              <Button size="sm" onClick={handleDescriptionSave}>
                Save description
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-4 md:order-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={handleDueDateBlur}
              />
            </div>
            <div className="flex flex-col gap-1 text-micro text-text-4">
              <span>Dibuat oleh {creatorName}</span>
              <span>Terakhir diubah {updatedRelative}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { lazy, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog"
import { TaskActionsMenu } from "./TaskActionsMenu"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { Database } from "@/types/database.types"
import { useMembers } from "@/features/members/useMembers"
import { useUpdateTask } from "./useTasks"
import { cn } from "cn"
import { Avatar } from "@/components/ui/avatar"
import { useTaskAssignees, useToggleAssignee } from "./useTaskAssignees"
import { LabelBadge } from "@/components/ui/label-badge"
import { useLabels, useTaskLabels, useToggleTaskLabel } from "./useLabels"
import { LabelsDialog } from "./LabelsDialog"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

const TITLE_INPUT_ID = "task-dialog-title"

// Lazy so the ProseMirror/Milkdown bundle loads only when a task is opened.
const MarkdownEditor = lazy(() => import("./MarkdownEditor"))

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
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false)
  const updateTask = useUpdateTask(projectId)
  const { data: members } = useMembers(projectId)
  const { data: assigneesByTask } = useTaskAssignees(projectId)
  const toggleAssignee = useToggleAssignee(task?.id ?? "", projectId)
  const { data: allLabels } = useLabels(projectId)
  const { data: labelsByTask } = useTaskLabels(projectId)
  const toggleLabel = useToggleTaskLabel(task?.id ?? "", projectId)

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

  const currentAssigneeIds = new Set(
    (assigneesByTask?.[currentTask.id] ?? []).map((a) => a.user_id)
  )

  const handleToggleAssignee = (userId: string) => {
    const isCurrentlyAssigned = currentAssigneeIds.has(userId)
    toggleAssignee.mutate({ userId, isCurrentlyAssigned })
  }

  const currentLabelIds = new Set(
    (labelsByTask?.[currentTask.id] ?? []).map((l) => l.id)
  )

  function handleToggleLabel(labelId: string) {
    const isCurrentlyApplied = currentLabelIds.has(labelId)
    toggleLabel.mutate({ labelId, isCurrentlyApplied })
  }

  return (
    <>
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
              {/* Uncontrolled editor: seed from the canonical task value and
                  remount per task via key. Local `descriptionMd` only tracks
                  edits for the Save button. */}
              <Suspense
                fallback={
                  <div className="h-40 animate-pulse rounded-md border border-line bg-surface-1" />
                }
              >
                <MarkdownEditor
                  key={currentTask.id}
                  value={currentTask.description_md ?? ""}
                  onChange={(v) => {
                    setDescriptionMd(v)
                    setDescriptionDirty(true)
                  }}
                />
              </Suspense>
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
              <div className="flex flex-col gap-2">
                <Label>Assignee</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(members ?? [])
                    .filter((m) => m.user_id)
                    .map((m) => {
                      const userId = m.user_id as string
                      const isAssigned = currentAssigneeIds.has(userId)
                      const name = m.profile?.full_name ?? m.profile?.email ?? m.invited_email
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleAssignee(userId)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-micro transition-colors [transition-duration:var(--dur-fast)]",
                            isAssigned
                              ? "border-accent-line bg-accent-soft text-accent-solid"
                              : "border-line text-text-3 hover:border-line-strong hover:text-text-2"
                          )}
                        >
                          <Avatar name={name} src={m.profile?.avatar_url} size="sm" />
                          {name}
                        </button>
                      )
                    })}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label>Label</Label>
                  <Button variant="ghost" size="sm" onClick={() => setLabelsDialogOpen(true)}>
                    Manage labels
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(allLabels ?? []).map((label) => {
                    const isApplied = currentLabelIds.has(label.id)
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleToggleLabel(label.id)}
                        className={cn(
                          "transition-opacity [transition-duration:var(--dur-fast)]",
                          !isApplied && "opacity-40 hover:opacity-70"
                        )}
                      >
                        <LabelBadge name={label.name} color={label.color} />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-micro text-text-4">
                <span>Dibuat oleh {creatorName}</span>
                <span>Terakhir diubah {updatedRelative}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <LabelsDialog projectId={projectId} open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen} />
    </>
  )
}

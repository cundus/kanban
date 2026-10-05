import { lazy, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog"
import { TaskActionsMenu } from "./TaskActionsMenu"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { Database } from "@/types/database.types"
import { useMembers } from "@/features/members/useMembers"
import { useUpdateTask } from "./useTasks"
import { Avatar } from "@/components/ui/avatar"
import { useTaskAssignees, useToggleAssignee } from "./useTaskAssignees"
import { LabelBadge } from "@/components/ui/label-badge"
import { useLabels, useTaskLabels, useToggleTaskLabel } from "./useLabels"
import { LabelsDialog } from "./LabelsDialog"
import { useTaskImages } from "./useTaskImages"
import { TaskImageUploader } from "./TaskImageUploader"
import { TaskSelection } from "./TaskSelection"

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
  const { data: members, isPending: membersLoading, isError: membersError } = useMembers(projectId)
  const { data: assigneesByTask, isPending: assigneesLoading, isError: assigneesError } = useTaskAssignees(projectId)
  const toggleAssignee = useToggleAssignee(task?.id ?? "", projectId)
  const { data: allLabels, isPending: labelsLoading, isError: labelsError } = useLabels(projectId)
  const { data: labelsByTask, isPending: taskLabelsLoading, isError: taskLabelsError } = useTaskLabels(projectId)
  const toggleLabel = useToggleTaskLabel(task?.id ?? "", projectId)
  const { data: imagesByTask } = useTaskImages(projectId)

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
        <DialogContent size="lg" className="sm:max-w-3xl">
          <DialogHeader className="flex flex-row items-center gap-2">
            <span className="shrink-0 select-all text-micro text-text-4" title="Serial number task">
              #{currentTask.serial_number}
            </span>
            <Input
              id={TITLE_INPUT_ID}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-heading min-w-0 flex-1 border-none px-0 shadow-none focus-visible:ring-0"
            />
            <TaskActionsMenu
              task={currentTask}
              projectId={projectId}
              variant="dropdown"
              disableRename
              onRename={() => {}}
            />
          </DialogHeader>

          <DialogBody className="grid gap-5 md:grid-cols-[1fr_16rem]">
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
              <TaskImageUploader
                taskId={currentTask.id}
                projectId={projectId}
                images={imagesByTask?.[currentTask.id] ?? []}
              />
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
                <Label htmlFor="task-assignee">Assignee</Label>
                <TaskSelection
                  id="task-assignee"
                  options={(members ?? [])
                    .filter((member) => member.user_id && member.status === "accepted")
                    .map((member) => {
                      const name = member.profile?.full_name ?? member.profile?.email ?? member.invited_email
                      return {
                        id: member.user_id as string,
                        name,
                        content: <><Avatar name={name} src={member.profile?.avatar_url} size="sm" /><span className="truncate">{name}</span></>,
                      }
                    })}
                  selectedIds={currentAssigneeIds}
                  placeholder="Select assignee"
                  emptyMessage="No members available"
                  loading={membersLoading || assigneesLoading}
                  disabled={toggleAssignee.isPending || membersError || assigneesError}
                  onToggle={handleToggleAssignee}
                />
                {(membersError || assigneesError) && <p role="alert" className="text-micro text-danger">Gagal memuat assignee.</p>}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="task-label">Label</Label>
                  <Button variant="ghost" size="sm" onClick={() => setLabelsDialogOpen(true)}>
                    Manage labels
                  </Button>
                </div>
                <TaskSelection
                  id="task-label"
                  options={(allLabels ?? []).map((label) => ({
                    id: label.id,
                    name: label.name,
                    content: <LabelBadge name={label.name} color={label.color} className="min-w-0 truncate" />,
                  }))}
                  selectedIds={currentLabelIds}
                  placeholder="Select label"
                  emptyMessage="No labels available"
                  loading={labelsLoading || taskLabelsLoading}
                  disabled={toggleLabel.isPending || labelsError || taskLabelsError}
                  onToggle={handleToggleLabel}
                />
                {(labelsError || taskLabelsError) && <p role="alert" className="text-micro text-danger">Gagal memuat label.</p>}
              </div>
              <div className="flex flex-col gap-1 text-micro text-text-4">
                <span>Dibuat oleh {creatorName}</span>
                <span>Terakhir diubah {updatedRelative}</span>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
      <LabelsDialog projectId={projectId} open={labelsDialogOpen} onOpenChange={setLabelsDialogOpen} />
    </>
  )
}

import { useState } from "react"
import { ArchiveIcon, RotateCcwIcon, TrashIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { Database } from "@/types/database.types"
import { useArchivedTasks } from "./useArchivedTasks"
import { useDeleteTask, useRestoreTask } from "./useTasks"

type ArchivedTask = Database["public"]["Tables"]["tasks"]["Row"] & {
  lists: { name: string } | null
}

interface ArchivedDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Dialog daftar task terarsip: restore atau hapus permanen. */
function ArchivedDialog({ projectId, open, onOpenChange }: ArchivedDialogProps) {
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const { data: archivedTasks, isLoading } = useArchivedTasks(projectId)
  const restoreTask = useRestoreTask(projectId)
  const deleteTask = useDeleteTask(projectId)

  // Supabase's join type is inferred as SelectQueryError because the tasks→lists
  // FK isn't declared in the generated types; the join succeeds at runtime.
  const tasks = (archivedTasks ?? []) as unknown as ArchivedTask[]

  const handleDeleteConfirm = () => {
    if (taskToDelete) {
      deleteTask.mutate(taskToDelete)
      setTaskToDelete(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Archived tasks</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={<ArchiveIcon size={18} strokeWidth={1.5} aria-hidden />}
              title="Belum ada task terarsip"
            />
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-ui text-text-1">{task.title}</span>
                  <span className="text-micro text-text-4">
                    {task.lists?.name ?? "Unknown list"} · Diarsipkan{" "}
                    {task.archived_at ? formatRelativeTime(task.archived_at) : ""}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Restore"
                    onClick={() => restoreTask.mutate(task.id)}
                  >
                    <RotateCcwIcon size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete permanently"
                    onClick={() => setTaskToDelete(task.id)}
                  >
                    <TrashIcon size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
      <ConfirmDialog
        open={!!taskToDelete}
        onOpenChange={(v) => {
          if (!v) setTaskToDelete(null)
        }}
        title="Delete permanently?"
        description="Task ini akan dihapus permanen dan tidak bisa dipulihkan."
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
      />
    </Dialog>
  )
}

export { ArchivedDialog }

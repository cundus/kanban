import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArchiveIcon,
  CopyIcon,
  FolderInputIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
  MenuTrigger,
} from "@/components/ui/menu"
import type { Database } from "@/types/database.types"
import { positionAtEnd } from "./reorderUtils"
import { useLists } from "./useLists"
import { tasksKey, useArchiveTask, useDeleteTask, useDuplicateTask, useMoveTask } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

interface TaskActionsMenuProps {
  task: Task
  projectId: string
  /** "context" = right-click menu on TaskCard, "dropdown" = plain menu in dialog header */
  variant: "context" | "dropdown"
  /** Dialog header already shows an editable title, so Rename is hidden there. */
  disableRename?: boolean
  onRename: () => void
  /** Only used for variant="context": the TaskCard wrapped by ContextMenuTrigger. */
  children?: React.ReactNode
}

interface TaskMenuItemsProps {
  task: Task
  projectId: string
  disableRename?: boolean
  onRename: () => void
  onDelete: () => void
  SubmenuContent: typeof MenuContent
}

// Rendered inside the popup, so query/mutation hooks only mount while the menu is open.
// Keeps every TaskCard on the board cheap to re-render during drag.
function TaskMenuItems({
  task,
  projectId,
  disableRename,
  onRename,
  onDelete,
  SubmenuContent,
}: TaskMenuItemsProps) {
  const queryClient = useQueryClient()
  const { data: lists } = useLists(projectId)
  const duplicateTask = useDuplicateTask(projectId)
  const archiveTask = useArchiveTask(projectId)
  const moveTask = useMoveTask(projectId)

  const handleCopyLink = async () => {
    const url = window.location.origin + window.location.pathname + "?task=" + task.id
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Tautan disalin.")
    } catch {
      toast.error("Gagal menyalin tautan.")
    }
  }

  const handleMoveToList = (targetListId: string) => {
    if (targetListId === task.list_id) return
    const cachedTasks = queryClient.getQueryData<Task[]>(tasksKey(projectId)) ?? []
    const targetListTasks = cachedTasks.filter((t) => t.list_id === targetListId)
    const newPosition = positionAtEnd(targetListTasks)
    moveTask.mutate({ taskId: task.id, toListId: targetListId, newPosition })
  }

  return (
    <>
      {!disableRename && (
        <MenuItem onClick={onRename}>
          <PencilIcon /> Rename
        </MenuItem>
      )}
      <MenuItem onClick={() => duplicateTask.mutate(task)}>
        <CopyIcon /> Duplicate
      </MenuItem>
      <MenuSubmenu>
        <MenuSubmenuTrigger>
          <FolderInputIcon /> Move to list
        </MenuSubmenuTrigger>
        <SubmenuContent>
          {(lists ?? []).map((list) => (
            <MenuItem
              key={list.id}
              disabled={list.id === task.list_id}
              onClick={() => handleMoveToList(list.id)}
            >
              {list.name}
            </MenuItem>
          ))}
        </SubmenuContent>
      </MenuSubmenu>
      <MenuItem onClick={handleCopyLink}>
        <LinkIcon /> Copy link
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => archiveTask.mutate(task.id)}>
        <ArchiveIcon /> Archive
      </MenuItem>
      <MenuItem className="text-danger" onClick={onDelete}>
        <TrashIcon /> Delete
      </MenuItem>
    </>
  )
}

function DeleteTaskDialog({
  task,
  projectId,
  onClose,
}: {
  task: Task
  projectId: string
  onClose: () => void
}) {
  const deleteTask = useDeleteTask(projectId)

  const handleConfirm = () => {
    // mutateAsync: per-call callbacks of mutate() are dropped once this dialog unmounts.
    deleteTask
      .mutateAsync(task.id)
      .then(() => toast.success("Task dihapus."))
      .catch(() => toast.error("Gagal menghapus task."))
    onClose()
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Delete task?"
      description={`Task "${task.title}" akan dihapus permanen.`}
      confirmLabel="Delete"
      onConfirm={handleConfirm}
    />
  )
}

/** Satu menu aksi task dipakai di TaskCard (context menu) dan header TaskDialog (dropdown). */
function TaskActionsMenu({
  task,
  projectId,
  variant,
  disableRename,
  onRename,
  children,
}: TaskActionsMenuProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isContext = variant === "context"
  const Content = isContext ? ContextMenuContent : MenuContent

  const items = (
    <Content>
      <TaskMenuItems
        task={task}
        projectId={projectId}
        disableRename={disableRename}
        onRename={onRename}
        onDelete={() => setConfirmOpen(true)}
        SubmenuContent={Content}
      />
    </Content>
  )

  const confirmDialog = confirmOpen && (
    <DeleteTaskDialog task={task} projectId={projectId} onClose={() => setConfirmOpen(false)} />
  )

  if (isContext) {
    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>{children}</ContextMenuTrigger>
          {items}
        </ContextMenu>
        {confirmDialog}
      </>
    )
  }

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Task actions">
              <MoreHorizontalIcon size={16} />
            </Button>
          }
        />
        {items}
      </Menu>
      {confirmDialog}
    </>
  )
}

export { TaskActionsMenu }

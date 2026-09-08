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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  ContextMenuSubmenuTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
  const queryClient = useQueryClient()
  const { data: lists } = useLists(projectId)
  const duplicateTask = useDuplicateTask(projectId)
  const archiveTask = useArchiveTask(projectId)
  const deleteTask = useDeleteTask(projectId)
  const moveTask = useMoveTask(projectId)

  const handleDuplicate = () => duplicateTask.mutate(task)

  const handleCopyLink = async () => {
    const url = window.location.origin + window.location.pathname + "?task=" + task.id
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Tautan disalin.")
    } catch {
      toast.error("Gagal menyalin tautan.")
    }
  }

  const handleArchive = () => archiveTask.mutate(task.id)

  const handleMoveToList = (targetListId: string) => {
    if (targetListId === task.list_id) return
    const cachedTasks = queryClient.getQueryData<Task[]>(tasksKey(projectId)) ?? []
    const targetListTasks = cachedTasks.filter((t) => t.list_id === targetListId)
    const newPosition = positionAtEnd(targetListTasks)
    moveTask.mutate({ taskId: task.id, toListId: targetListId, newPosition })
  }

  const handleDeleteConfirm = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => toast.success("Task dihapus."),
    })
    setConfirmOpen(false)
  }

  const confirmDialog = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Delete task?"
      description={`Task "${task.title}" akan dihapus permanen.`}
      confirmLabel="Delete"
      onConfirm={handleDeleteConfirm}
    />
  )

  if (variant === "context") {
    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>{children}</ContextMenuTrigger>
          <ContextMenuContent>
            {!disableRename && (
              <ContextMenuItem onClick={onRename}>
                <PencilIcon /> Rename
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={handleDuplicate}>
              <CopyIcon /> Duplicate
            </ContextMenuItem>
            <ContextMenuSubmenu>
              <ContextMenuSubmenuTrigger>
                <FolderInputIcon /> Move to list
              </ContextMenuSubmenuTrigger>
              <ContextMenuContent>
                {(lists ?? []).map((list) => (
                  <ContextMenuItem
                    key={list.id}
                    disabled={list.id === task.list_id}
                    onClick={() => handleMoveToList(list.id)}
                  >
                    {list.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuContent>
            </ContextMenuSubmenu>
            <ContextMenuItem onClick={handleCopyLink}>
              <LinkIcon /> Copy link
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleArchive}>
              <ArchiveIcon /> Archive
            </ContextMenuItem>
            <ContextMenuItem className="text-danger" onClick={() => setConfirmOpen(true)}>
              <TrashIcon /> Delete
            </ContextMenuItem>
          </ContextMenuContent>
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
        <MenuContent>
          {!disableRename && (
            <MenuItem onClick={onRename}>
              <PencilIcon /> Rename
            </MenuItem>
          )}
          <MenuItem onClick={handleDuplicate}>
            <CopyIcon /> Duplicate
          </MenuItem>
          <MenuSubmenu>
            <MenuSubmenuTrigger>
              <FolderInputIcon /> Move to list
            </MenuSubmenuTrigger>
            <MenuContent>
              {(lists ?? []).map((list) => (
                <MenuItem
                  key={list.id}
                  disabled={list.id === task.list_id}
                  onClick={() => handleMoveToList(list.id)}
                >
                  {list.name}
                </MenuItem>
              ))}
            </MenuContent>
          </MenuSubmenu>
          <MenuItem onClick={handleCopyLink}>
            <LinkIcon /> Copy link
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={handleArchive}>
            <ArchiveIcon /> Archive
          </MenuItem>
          <MenuItem className="text-danger" onClick={() => setConfirmOpen(true)}>
            <TrashIcon /> Delete
          </MenuItem>
        </MenuContent>
      </Menu>
      {confirmDialog}
    </>
  )
}

export { TaskActionsMenu }

import { useMemo, useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import type { Database } from "@/types/database.types"
import { TaskCard } from "./TaskCard"
import { useDeleteList, useRenameList } from "./useLists"
import { useCreateTask } from "./useTasks"

type List = Database["public"]["Tables"]["lists"]["Row"]
type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function ListColumn({
  list,
  projectId,
  tasks,
  onOpenTask,
  overlay = false,
}: {
  list: List
  projectId: string
  tasks: Task[]
  onOpenTask: (taskId: string) => void
  overlay?: boolean
}) {
  const createTask = useCreateTask(list.id, projectId)
  const renameList = useRenameList(projectId)
  const deleteList = useDeleteList(projectId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id, data: { type: "list" } })
  const { setNodeRef: setDropRef } = useDroppable({
    id: `list-dropzone-${list.id}`,
    data: { type: "list", listId: list.id },
  })

  const [isEditingName, setIsEditingName] = useState(false)
  const [name, setName] = useState(list.name)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleRename() {
    if (name.trim() && name !== list.name) {
      renameList.mutate({ id: list.id, name })
    }
    setIsEditingName(false)
  }

  function handleAddTask() {
    if (!newTaskTitle.trim()) return
    createTask.mutate(newTaskTitle, {
      onSuccess: () => setNewTaskTitle(""),
    })
  }

  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }

  // A fresh array identity every render makes SortableContext re-sort and
  // restart neighbour animations mid-drag (onDragOver rebuilds tasks on every
  // pointer move).
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])

  return (
    <section
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={
        overlay
          ? "elev-lifted flex w-72 shrink-0 rotate-2 scale-[1.03] flex-col gap-3 rounded-lg border border-accent-line bg-surface-2 p-3"
          : "group/list flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-line bg-surface-1 p-3 transition-colors [transition-duration:var(--dur-fast)] hover:border-line-strong"
      }
    >
      <div className="flex items-center justify-between gap-2">
        {isEditingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
        ) : (
          <h3
            className="flex-1 cursor-grab truncate text-label text-text-1 active:cursor-grabbing"
            onClick={() => setIsEditingName(true)}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
          >
            {list.name}
          </h3>
        )}
        <div className="flex shrink-0 items-center gap-2">
          <span data-numeric className="text-micro text-text-4">
            {tasks.length}
          </span>
          <Tooltip label="Delete list">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${list.name}`}
              className="rounded-full text-text-3 opacity-0 hover:text-danger group-hover/list:opacity-100 focus-visible:opacity-100"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon size={14} strokeWidth={1.5} aria-hidden />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div ref={overlay ? undefined : setDropRef} className="flex min-h-2 flex-col gap-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              listId={list.id}
              onOpen={() => onOpenTask(task.id)}
            />
          ))}
        </SortableContext>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
        />
        <Button size="sm" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
          Add
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${list.name}?`}
        description="Every task in this list is removed too. This cannot be undone."
        onConfirm={() => deleteList.mutate(list.id)}
      />
    </section>
  )
}

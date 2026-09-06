import { useState } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
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
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border bg-card p-3"
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
            className="flex-1 cursor-grab truncate font-medium active:cursor-grabbing"
            onClick={() => setIsEditingName(true)}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
          >
            {list.name}
          </h3>
        )}
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={() => deleteList.mutate(list.id)}>
            ✕
          </Button>
        </div>
      </div>

      <div ref={overlay ? undefined : setDropRef} className="flex min-h-2 flex-col gap-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
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
        <Button size="sm" onClick={handleAddTask}>
          Add
        </Button>
      </div>
    </div>
  )
}

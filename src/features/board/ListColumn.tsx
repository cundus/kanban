import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Database } from "@/types/database.types"
import { TaskCard } from "./TaskCard"
import { useDeleteList, useRenameList, useReorderList } from "./useLists"
import { useCreateTask, useTasks } from "./useTasks"

type List = Database["public"]["Tables"]["lists"]["Row"]

export function ListColumn({
  list,
  projectId,
  isFirst,
  isLast,
  onOpenTask,
}: {
  list: List
  projectId: string
  isFirst: boolean
  isLast: boolean
  onOpenTask: (taskId: string) => void
}) {
  const { data: tasks } = useTasks(list.id)
  const createTask = useCreateTask(list.id)
  const renameList = useRenameList(projectId)
  const deleteList = useDeleteList(projectId)
  const reorderList = useReorderList(projectId)

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

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border bg-card p-3">
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
            className="cursor-pointer truncate font-medium"
            onClick={() => setIsEditingName(true)}
          >
            {list.name}
          </h3>
        )}
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={isFirst}
            onClick={() => reorderList.mutate({ listId: list.id, direction: "up" })}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isLast}
            onClick={() => reorderList.mutate({ listId: list.id, direction: "down" })}
          >
            ↓
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteList.mutate(list.id)}>
            ✕
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tasks?.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            listId={list.id}
            isFirst={index === 0}
            isLast={index === (tasks.length ?? 1) - 1}
            onOpen={() => onOpenTask(task.id)}
          />
        ))}
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

import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ListColumn } from "./ListColumn"
import { TaskDialog } from "./TaskDialog"
import { useCreateList, useLists } from "./useLists"
import { useTasks } from "./useTasks"

export function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate("/")
    return null
  }

  const { data: lists, isLoading } = useLists(projectId)
  const createList = useCreateList(projectId)

  const [newListName, setNewListName] = useState("")
  const [openTask, setOpenTask] = useState<{ taskId: string; listId: string } | null>(null)

  function handleAddList() {
    if (!newListName.trim()) return
    createList.mutate(newListName, { onSuccess: () => setNewListName("") })
  }

  return (
    <div className="flex h-svh flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/")}>
          ← Back to projects
        </Button>
        <div className="flex gap-2">
          <Input
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddList()}
          />
          <Button onClick={handleAddList}>Add list</Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="flex flex-1 gap-4 overflow-x-auto">
        {lists?.map((list, index) => (
          <ListColumn
            key={list.id}
            list={list}
            projectId={projectId}
            isFirst={index === 0}
            isLast={index === (lists.length ?? 1) - 1}
            onOpenTask={(taskId) => setOpenTask({ taskId, listId: list.id })}
          />
        ))}
      </div>

      {openTask && (
        <TaskDialogForOpenTask
          taskId={openTask.taskId}
          listId={openTask.listId}
          onOpenChange={(open) => !open && setOpenTask(null)}
        />
      )}
    </div>
  )
}

function TaskDialogForOpenTask({
  taskId,
  listId,
  onOpenChange,
}: {
  taskId: string
  listId: string
  onOpenChange: (open: boolean) => void
}) {
  const { data: tasks } = useTasks(listId)
  const task = tasks?.find((t) => t.id === taskId) ?? null

  return (
    <TaskDialog task={task} listId={listId} open={!!task} onOpenChange={onOpenChange} />
  )
}

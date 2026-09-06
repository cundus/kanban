import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Database } from "@/types/database.types"
import { ListColumn } from "./ListColumn"
import { TaskDialog } from "./TaskDialog"
import { useCreateList, useLists } from "./useLists"
import { useTasks } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate("/")
    return null
  }

  const { data: lists, isLoading } = useLists(projectId)
  const { data: allTasks } = useTasks(projectId)
  const createList = useCreateList(projectId)

  const [newListName, setNewListName] = useState("")
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  const tasksByList = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of allTasks ?? []) {
      const arr = map.get(t.list_id) ?? []
      arr.push(t)
      map.set(t.list_id, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position)
    return map
  }, [allTasks])

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
        {lists?.map((list) => (
          <ListColumn
            key={list.id}
            list={list}
            projectId={projectId}
            tasks={tasksByList.get(list.id) ?? []}
            onOpenTask={(taskId) => setOpenTaskId(taskId)}
          />
        ))}
      </div>

      {openTaskId && (
        <TaskDialogForOpenTask
          taskId={openTaskId}
          tasks={allTasks ?? []}
          projectId={projectId}
          onOpenChange={(open) => !open && setOpenTaskId(null)}
        />
      )}
    </div>
  )
}

function TaskDialogForOpenTask({
  taskId,
  tasks,
  projectId,
  onOpenChange,
}: {
  taskId: string
  tasks: Task[]
  projectId: string
  onOpenChange: (open: boolean) => void
}) {
  const task = tasks.find((t) => t.id === taskId) ?? null

  return (
    <TaskDialog task={task} projectId={projectId} open={!!task} onOpenChange={onOpenChange} />
  )
}

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/types/database.types"
import { useReorderTask } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskCard({
  task,
  listId,
  isFirst,
  isLast,
  onOpen,
}: {
  task: Task
  listId: string
  isFirst: boolean
  isLast: boolean
  onOpen: () => void
}) {
  const reorderTask = useReorderTask(listId)

  return (
    <Card className="cursor-pointer" onClick={onOpen}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <CardTitle className="text-sm font-normal">{task.title}</CardTitle>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            disabled={isFirst}
            onClick={() => reorderTask.mutate({ taskId: task.id, direction: "up" })}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isLast}
            onClick={() => reorderTask.mutate({ taskId: task.id, direction: "down" })}
          >
            ↓
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}

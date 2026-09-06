import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskCard({
  task,
  listId,
  onOpen,
  overlay = false,
}: {
  task: Task
  listId: string
  onOpen: () => void
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", listId } })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
    >
      <Card className={overlay ? "cursor-grabbing" : "cursor-pointer"}>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-normal">{task.title}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}

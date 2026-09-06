import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/types/database.types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskCard({
  task,
  onOpen,
}: {
  task: Task
  onOpen: () => void
}) {
  return (
    <Card className="cursor-pointer" onClick={onOpen}>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-normal">{task.title}</CardTitle>
      </CardHeader>
    </Card>
  )
}

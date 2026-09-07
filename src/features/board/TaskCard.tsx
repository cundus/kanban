import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
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

  // Transform (not Translate) so neighbours animate fully when a gap opens.
  // opacity 0 hides the source while DragOverlay follows the cursor; dnd-kit
  // keeps this node mounted so the slot stays reserved.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      className={cn(
        "rounded-lg border bg-surface-2 px-3 py-2.5 text-ui text-text-1",
        overlay
          // Signature drag lift: DESIGN.md 6
          ? "elev-lifted rotate-2 scale-[1.03] cursor-grabbing border-accent-line"
          : "cursor-pointer border-line transition-[background-color,border-color,transform] [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-out)] hover:border-line-strong hover:bg-surface-3 active:translate-y-px",
      )}
    >
      {task.title}
    </article>
  )
}

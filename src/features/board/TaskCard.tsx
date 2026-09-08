import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import type { Database } from "@/types/database.types"
import { Avatar } from "@/components/ui/avatar"
import { TaskActionsMenu } from "./TaskActionsMenu"
import { useTaskAssignees } from "./useTaskAssignees"
import type { AssigneeProfile } from "./useTaskAssignees"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskCard({
  task,
  listId,
  projectId,
  onOpen,
  onRenameTask,
  overlay = false,
}: {
  task: Task
  listId: string
  projectId: string
  onOpen: () => void
  onRenameTask: () => void
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", listId } })

  const { data: assigneesByTask } = useTaskAssignees(projectId)
  const assignees = assigneesByTask?.[task.id] ?? []

  // Transform (not Translate) so neighbours animate fully when a gap opens.
  // opacity 0 hides the source while DragOverlay follows the cursor; dnd-kit
  // keeps this node mounted so the slot stays reserved.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  if (overlay) {
    return (
      <article
        // Signature drag lift: DESIGN.md 6
        className="elev-lifted rounded-lg border border-accent-line bg-surface-2 px-3 py-2.5 text-ui text-text-1 rotate-2 scale-[1.03] cursor-grabbing"
      >
        {task.title}
        {assignees.length > 0 && <AvatarStack assignees={assignees} />}
      </article>
    )
  }

  return (
    <TaskActionsMenu task={task} projectId={projectId} variant="context" onRename={onRenameTask}>
      <article
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className={cn(
          "group/card relative rounded-lg border bg-surface-2 px-3 py-2.5 text-ui text-text-1",
          "cursor-pointer border-line transition-[background-color,border-color,transform] [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-out)] hover:border-line-strong hover:bg-surface-3 active:translate-y-px",
        )}
      >
        {task.title}
        {assignees.length > 0 && <AvatarStack assignees={assignees} />}
        <div
          className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/card:opacity-100 sm:opacity-0 max-sm:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <TaskActionsMenu task={task} projectId={projectId} variant="dropdown" onRename={onRenameTask} />
        </div>
      </article>
    </TaskActionsMenu>
  )
}

function AvatarStack({ assignees }: { assignees: AssigneeProfile[] }) {
  const shown = assignees.slice(0, 3)
  const extra = assignees.length - shown.length
  return (
    <div className="mt-1.5 flex -space-x-2">
      {shown.map((a) => (
        <Avatar
          key={a.user_id}
          name={a.full_name ?? a.email}
          src={a.avatar_url}
          size="sm"
          className="ring-2 ring-surface-2"
        />
      ))}
      {extra > 0 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-3 text-[10px] text-text-3 ring-2 ring-surface-2">
          +{extra}
        </span>
      )}
    </div>
  )
}

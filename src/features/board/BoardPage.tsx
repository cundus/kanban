import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DropAnimation,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { ArrowLeftIcon, Columns3Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/ui/empty-state"
import { ThemeToggle } from "@/components/ThemeToggle"
import type { Database } from "@/types/database.types"
import { ListColumn } from "./ListColumn"
import { TaskCard } from "./TaskCard"
import { TaskDialog } from "./TaskDialog"
import { positionBetween, positionForIndex } from "./reorderUtils"
import { useCreateList, useLists, useReorderList } from "./useLists"
import { useMoveTask, useTasks } from "./useTasks"
import { useProject } from "@/features/projects/useProjects"
import { MembersDialog } from "@/features/members/MembersDialog"
import { useExportProject } from "@/features/import-export/useExportProject"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
type List = Database["public"]["Tables"]["lists"]["Row"]

// On drop isDragging flips false and the source would jump back to opacity 1
// while the overlay is still flying. Holding it at 0 for the animation keeps a
// single visible card.
const dropAnimation: DropAnimation = {
  duration: 200,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
}

export function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate("/")
    return null
  }

  const { data: lists, isLoading } = useLists(projectId)
  const { data: allTasks } = useTasks(projectId)
  const { data: project } = useProject(projectId)
  const createList = useCreateList(projectId)
  const moveTask = useMoveTask(projectId)
  const reorderList = useReorderList(projectId)
  const { exportNow } = useExportProject(projectId)

  const [newListName, setNewListName] = useState("")
  const [membersOpen, setMembersOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const taskIdFromUrl = searchParams.get("task")
  const [autoFocusTitle, setAutoFocusTitle] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeList, setActiveList] = useState<List | null>(null)
  const [dndTasks, setDndTasks] = useState<Task[] | null>(null)

  // Mouse: start drag after a small move. Touch: require a short press-and-hold
  // before dragging so that plain swipes still scroll the board/list normally.
  // Keyboard: preserve accessible drag via arrow keys.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const effectiveTasks = dndTasks ?? allTasks ?? []

  const tasksByList = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of effectiveTasks) {
      const arr = map.get(t.list_id) ?? []
      arr.push(t)
      map.set(t.list_id, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position)
    return map
  }, [effectiveTasks])

  const listIds = useMemo(
    () => [...(lists ?? [])].sort((a, b) => a.position - b.position).map((l) => l.id),
    [lists]
  )

  function resolveContainer(taskArr: Task[], id: string): string | null {
    if (id.startsWith("list-dropzone-")) return id.slice("list-dropzone-".length)
    if ((lists ?? []).some((l) => l.id === id)) return id
    return taskArr.find((t) => t.id === id)?.list_id ?? null
  }

  function handleAddList() {
    if (!newListName.trim()) return
    createList.mutate(newListName, { onSuccess: () => setNewListName("") })
  }

  function handleOpenTask(taskId: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("task", taskId)
      return next
    })
  }

  function handleCloseTaskDialog() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("task")
        return next
      },
      { replace: true }
    )
    setAutoFocusTitle(false)
  }

  function handleRenameTask(taskId: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("task", taskId)
      return next
    })
    setAutoFocusTitle(true)
  }

  function onDragStart(event: DragStartEvent) {
    const { active } = event
    const type = active.data.current?.type
    if (type === "task") {
      const t = (allTasks ?? []).find((x) => x.id === String(active.id)) ?? null
      setActiveTask(t)
      setDndTasks(allTasks ?? [])
    } else if (type === "list") {
      setActiveList((lists ?? []).find((x) => x.id === String(active.id)) ?? null)
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.data.current?.type !== "task") return

    const activeId = String(active.id)
    const overId = String(over.id)
    const base = dndTasks ?? allTasks ?? []
    const activeContainer = resolveContainer(base, activeId)
    const overContainer = resolveContainer(base, overId)
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setDndTasks(() => {
      const moved = base.find((t) => t.id === activeId)
      if (!moved) return base

      const overItems = base
        .filter((t) => t.list_id === overContainer && t.id !== activeId)
        .sort((a, b) => a.position - b.position)
      const overIndex = overItems.findIndex((t) => t.id === overId)

      let insertIndex: number
      if (overIndex === -1) {
        insertIndex = overItems.length
      } else {
        const translated = active.rect.current.translated
        const isBelow =
          translated != null &&
          translated.top > over.rect.top + over.rect.height / 2
        insertIndex = overIndex + (isBelow ? 1 : 0)
      }

      const prevPos = insertIndex > 0 ? overItems[insertIndex - 1].position : null
      const nextPos =
        insertIndex < overItems.length ? overItems[insertIndex].position : null
      const newPosition = positionBetween(prevPos, nextPos)

      return base.map((t) =>
        t.id === activeId
          ? { ...t, list_id: overContainer, position: newPosition }
          : t
      )
    })
  }

  function onDragCancel() {
    setActiveTask(null)
    setActiveList(null)
    setDndTasks(null)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const type = active.data.current?.type
    setActiveTask(null)
    setActiveList(null)

    if (!over) {
      setDndTasks(null)
      return
    }

    const activeId = String(active.id)
    const overId = String(over.id)

    if (type === "list") {
      setDndTasks(null)
      if (activeId === overId) return
      const sorted = [...(lists ?? [])].sort((a, b) => a.position - b.position)
      const activeIndex = sorted.findIndex((l) => l.id === activeId)
      const overIndex = sorted.findIndex((l) => l.id === overId)
      if (activeIndex === -1 || overIndex === -1) return
      const targetIndex = overIndex + (activeIndex < overIndex ? 1 : 0)
      const newPosition = positionForIndex(sorted, targetIndex, activeId)
      reorderList.mutate({ listId: activeId, newPosition })
      return
    }

    // task drop — `base` already reflects any cross-list move from onDragOver
    const base = dndTasks ?? allTasks ?? []
    const toListId =
      resolveContainer(base, overId) ??
      base.find((t) => t.id === activeId)?.list_id ??
      null
    if (!toListId) {
      setDndTasks(null)
      return
    }

    const listTasks = base
      .filter((t) => t.list_id === toListId)
      .sort((a, b) => a.position - b.position)
    const activeIndex = listTasks.findIndex((t) => t.id === activeId)
    const overIsTask = base.some((t) => t.id === overId)

    let targetIndex: number
    if (overIsTask && overId !== activeId) {
      const overIndex = listTasks.findIndex((t) => t.id === overId)
      targetIndex =
        overIndex === -1
          ? listTasks.length
          : overIndex + (activeIndex !== -1 && activeIndex < overIndex ? 1 : 0)
    } else {
      targetIndex = activeIndex === -1 ? listTasks.length : activeIndex
    }

    const newPosition = positionForIndex(listTasks, targetIndex, activeId)

    const original = (allTasks ?? []).find((t) => t.id === activeId)
    if (original && original.list_id === toListId && original.position === newPosition) {
      setDndTasks(null)
      return
    }

    // onDragOver skips same-list drags, so the mirror can still hold the
    // pre-drag order here. Commit the final placement before the drop animation
    // measures, then release only once the optimistic cache patch has landed —
    // useMoveTask awaits cancelQueries, so clearing earlier renders one frame at
    // the old position.
    setDndTasks(
      base.map((t) =>
        t.id === activeId ? { ...t, list_id: toListId, position: newPosition } : t
      )
    )
    moveTask.mutate(
      { taskId: activeId, toListId, newPosition },
      { onSettled: () => setDndTasks(null) }
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle px-6 py-4">
        <div className="flex items-center gap-3">
          <Tooltip label="Back to projects">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Back to projects"
              onClick={() => navigate("/")}
            >
              <ArrowLeftIcon size={16} strokeWidth={1.5} aria-hidden />
            </Button>
          </Tooltip>
          <h1 className="text-heading text-text-1">{project?.name ?? "Board"}</h1>
          <Button variant="ghost" onClick={() => setMembersOpen(true)}>
            Members
          </Button>
          <Button variant="ghost" onClick={() => void exportNow()}>
            Export
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-44"
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddList()}
          />
          <Button onClick={handleAddList} disabled={!newListName.trim()}>
            Add list
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <main
          id="main"
          className="flex flex-1 gap-4 overflow-x-auto px-6 py-6"
          aria-busy={isLoading}
        >
          {isLoading ? (
            Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-line bg-surface-1 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 - i }, (_, j) => (
                    <Skeleton key={j} className="h-14 w-full" />
                  ))}
                </div>
              </div>
            ))
          ) : lists?.length ? (
            <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
              {lists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  projectId={projectId}
                  tasks={tasksByList.get(list.id) ?? []}
                  onOpenTask={handleOpenTask}
                  onRenameTask={handleRenameTask}
                />
              ))}
            </SortableContext>
          ) : (
            <EmptyState
              className="flex-1"
              icon={<Columns3Icon size={18} strokeWidth={1.5} aria-hidden />}
              title="No lists yet"
              description="Lists are the columns of this board. Name one above and press Add list to start."
            />
          )}
        </main>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              listId={activeTask.list_id}
              projectId={projectId}
              onOpen={() => {}}
              onRenameTask={() => {}}
              overlay
            />
          ) : activeList ? (
            <ListColumn
              list={activeList}
              projectId={projectId}
              tasks={tasksByList.get(activeList.id) ?? []}
              onOpenTask={() => {}}
              onRenameTask={() => {}}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {taskIdFromUrl && (
        <TaskDialogForOpenTask
          taskId={taskIdFromUrl}
          tasks={allTasks ?? []}
          projectId={projectId}
          autoFocusTitle={autoFocusTitle}
          onOpenChange={(open) => !open && handleCloseTaskDialog()}
        />
      )}

      {membersOpen && (
        <MembersDialog
          projectId={projectId}
          projectName={project?.name ?? ""}
          open={membersOpen}
          onOpenChange={setMembersOpen}
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
  autoFocusTitle,
}: {
  taskId: string
  tasks: Task[]
  projectId: string
  onOpenChange: (open: boolean) => void
  autoFocusTitle?: boolean
}) {
  const task = tasks.find((t) => t.id === taskId) ?? null

  // Only fire the "not found" toast once tasks have actually loaded — before
  // then, an absent task is just the initial fetch, not a stale/bad URL.
  useEffect(() => {
    if (taskId && !task && tasks.length > 0) {
      toast.error("Task tidak ditemukan.")
      onOpenChange(false)
    }
  }, [taskId, task, tasks.length, onOpenChange])

  return (
    <TaskDialog
      task={task}
      projectId={projectId}
      open={!!task}
      onOpenChange={onOpenChange}
      autoFocusTitle={autoFocusTitle}
    />
  )
}

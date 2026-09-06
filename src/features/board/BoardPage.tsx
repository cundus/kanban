import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Database } from "@/types/database.types"
import { ListColumn } from "./ListColumn"
import { TaskCard } from "./TaskCard"
import { TaskDialog } from "./TaskDialog"
import { positionBetween, positionForIndex } from "./reorderUtils"
import { useCreateList, useLists, useReorderList } from "./useLists"
import { useMoveTask, useTasks } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
type List = Database["public"]["Tables"]["lists"]["Row"]

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
  const moveTask = useMoveTask(projectId)
  const reorderList = useReorderList(projectId)

  const [newListName, setNewListName] = useState("")
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeList, setActiveList] = useState<List | null>(null)
  const [dndTasks, setDndTasks] = useState<Task[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
    setDndTasks(null)
    if (!toListId) return

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
      return
    }
    moveTask.mutate({ taskId: activeId, toListId, newPosition })
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto">
          <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
            {lists?.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                projectId={projectId}
                tasks={tasksByList.get(list.id) ?? []}
                onOpenTask={(taskId) => setOpenTaskId(taskId)}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              listId={activeTask.list_id}
              onOpen={() => {}}
              overlay
            />
          ) : activeList ? (
            <ListColumn
              list={activeList}
              projectId={projectId}
              tasks={tasksByList.get(activeList.id) ?? []}
              onOpenTask={() => {}}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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

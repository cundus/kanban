import { useState } from "react"
import { Link } from "react-router-dom"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { formatRelativeTime } from "@/lib/formatRelativeTime"
import type { ProjectStats } from "./useProjects"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export function ProjectCard({
  project,
  isOwner,
  lead = false,
  stats,
  statsLoading = false,
  onEdit,
  onDelete,
}: {
  project: Project
  isOwner: boolean
  lead?: boolean
  stats?: ProjectStats
  statsLoading?: boolean
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <article className="group/card relative flex h-full flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4 transition-[background-color,border-color,transform] [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-3 focus-within:border-accent-line">
      <div className="flex items-start justify-between gap-3">
        {/* Stretched link keeps the whole card clickable without nesting interactives */}
        <h2 className={lead ? "text-title text-text-1" : "text-heading text-text-1"}>
          <Link
            to={`/projects/${project.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-lg"
          >
            {project.name}
          </Link>
        </h2>
        <span
          className={
            isOwner
              ? "shrink-0 rounded-xs border border-accent-line bg-accent-soft px-1.5 py-0.5 text-micro text-accent-solid"
              : "shrink-0 rounded-xs border border-line px-1.5 py-0.5 text-micro text-text-3"
          }
        >
          {isOwner ? "Owner" : "Member"}
        </span>
      </div>

      {project.description && (
        <p
          className={
            lead
              ? "line-clamp-3 max-w-[52ch] text-label text-text-3"
              : "line-clamp-2 max-w-[52ch] text-label text-text-3"
          }
        >
          {project.description}
        </p>
      )}

      {statsLoading ? (
        <Skeleton className="h-3 w-32 rounded-xs" />
      ) : (
        <p className="text-micro text-text-3 tabular-nums">{describeStats(stats)}</p>
      )}

      {isOwner && (
        <div className="relative z-10 mt-auto flex justify-end gap-1 pt-1 opacity-100 transition-opacity [transition-duration:var(--dur-fast)] [@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-within:opacity-100">
          <Tooltip label="Rename">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${project.name}`}
              onClick={() => onEdit(project)}
            >
              <PencilIcon size={14} strokeWidth={1.5} aria-hidden />
            </Button>
          </Tooltip>
          <Tooltip label="Delete">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${project.name}`}
              className="hover:text-danger"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon size={14} strokeWidth={1.5} aria-hidden />
            </Button>
          </Tooltip>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${project.name}?`}
        description="Its lists and tasks are removed too. This cannot be undone."
        onConfirm={() => onDelete(project.id)}
      />
    </article>
  )
}

function describeStats(stats: ProjectStats | undefined): string {
  if (!stats || stats.count === 0) return "No tasks yet"
  const tasks = `${stats.count} ${stats.count === 1 ? "task" : "tasks"}`
  if (!stats.lastUpdated) return tasks
  return `${tasks} · Updated ${formatRelativeTime(stats.lastUpdated)}`
}

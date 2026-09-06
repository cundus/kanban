import { useNavigate } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export function ProjectCard({
  project,
  isOwner,
  onEdit,
  onDelete,
}: {
  project: Project
  isOwner: boolean
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{project.name}</CardTitle>
          {isOwner ? (
            <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              Owner
            </span>
          ) : (
            <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
              Member
            </span>
          )}
        </div>
        {project.description && (
          <CardDescription>{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
          Open
        </Button>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onEdit(project)}>
              Edit
            </Button>
            <Button variant="ghost" onClick={() => onDelete(project.id)}>
              Delete
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

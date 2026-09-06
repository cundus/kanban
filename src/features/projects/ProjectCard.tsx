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
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
        {project.description && (
          <CardDescription>{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
          Open
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onEdit(project)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => onDelete(project.id)}>
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

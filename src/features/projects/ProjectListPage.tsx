import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ProjectCard } from "./ProjectCard"
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "./useProjects"
import { useAuth } from "@/features/auth/useAuth"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const { signOut } = useAuth()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  function openCreateDialog() {
    setEditing(null)
    setName("")
    setDescription("")
    setDialogOpen(true)
  }

  function openEditDialog(project: Project) {
    setEditing(project)
    setName(project.name)
    setDescription(project.description ?? "")
    setDialogOpen(true)
  }

  function handleSave() {
    if (editing) {
      updateProject.mutate(
        { id: editing.id, name, description: description || null },
        { onSuccess: () => setDialogOpen(false) }
      )
    } else {
      createProject.mutate(
        { name, description: description || null },
        { onSuccess: () => setDialogOpen(false) }
      )
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Projects</h1>
        <div className="flex gap-2">
          <Button onClick={openCreateDialog}>New Project</Button>
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isOwner={project.isOwner}
            onEdit={openEditDialog}
            onDelete={(id) => deleteProject.mutate(id)}
          />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

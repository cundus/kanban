import { useState } from "react"
import {
  ChevronDownIcon,
  FolderPlusIcon,
  KeyIcon,
  LogOutIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  UploadIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu"
import { useTheme } from "@/lib/theme"
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
  useProjectStats,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  type ProjectStats,
  type ProjectWithRole,
} from "./useProjects"
import { useAuth } from "@/features/auth/useAuth"
import { ImportDialog } from "@/features/import-export/ImportDialog"
import { ApiTokensDialog } from "./ApiTokensDialog"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

const MIN_PROJECTS_FOR_LEAD_CARD = 3

export function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const { data: stats, isLoading: statsLoading } = useProjectStats()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const { session, signOut } = useAuth()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
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

  const owned = projects?.filter((project) => project.isOwner) ?? []
  const shared = projects?.filter((project) => !project.isOwner) ?? []
  const showSectionHeadings = owned.length > 0 && shared.length > 0

  function renderSection(heading: string, items: ProjectWithRole[], allowLead: boolean) {
    if (items.length === 0) return null
    const headingId = `projects-${heading.toLowerCase().replace(/\s+/g, "-")}`
    return (
      <section aria-labelledby={showSectionHeadings ? headingId : undefined}>
        {showSectionHeadings && (
          <h2 id={headingId} className="pb-3 text-label text-text-3">
            {heading}
          </h2>
        )}
        <ProjectGrid
          items={items}
          allowLead={allowLead}
          stats={stats}
          statsLoading={statsLoading}
          onEdit={openEditDialog}
          onDelete={(id) => deleteProject.mutate(id)}
        />
      </section>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      {/* Same accent glow as the login page so both routes read as one product. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent-soft blur-[120px]"
      />

      <header className="relative mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-accent-solid" />
          <span className="text-ui text-text-2">Personal kanban</span>
        </div>
        <div className="flex items-center gap-2">
          <CreateProjectButton
            onCreate={openCreateDialog}
            onImport={() => setImportOpen(true)}
          />
          <ProfileMenu
            email={session?.user.email ?? null}
            avatarUrl={session?.user.user_metadata.avatar_url ?? null}
            userId={session?.user.id ?? null}
            onSignOut={() => signOut()}
          />
        </div>
      </header>

      <main
        id="main"
        className="relative mx-auto w-full max-w-[1200px] flex-1 px-4 pt-4 pb-16 sm:px-6"
        aria-busy={isLoading}
      >
        <h1 className="pb-6 text-title text-text-1">Projects</h1>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton
                key={i}
                className="h-36 first:md:col-span-2 first:xl:col-span-2"
              />
            ))}
          </div>
        ) : projects?.length ? (
          <div className="flex flex-col gap-8">
            {renderSection("Owned", owned, true)}
            {renderSection("Shared with you", shared, owned.length === 0)}
          </div>
        ) : (
          <EmptyState
            icon={<FolderPlusIcon size={18} strokeWidth={1.5} aria-hidden />}
            title="No projects yet"
            description="A project holds your lists and tasks. Create one, or import a board you exported earlier."
            action={<Button onClick={openCreateDialog}>New project</Button>}
          />
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Rename project" : "New project"}</DialogTitle>
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

      {importOpen && (
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      )}
    </div>
  )
}

/** Split button: primary action stays one click, import hides behind the chevron. */
function CreateProjectButton({
  onCreate,
  onImport,
}: {
  onCreate: () => void
  onImport: () => void
}) {
  return (
    <div className="flex items-center">
      <Tooltip label="Create a new project">
        <Button className="rounded-r-none" onClick={onCreate}>
          <PlusIcon size={16} strokeWidth={1.5} aria-hidden />
          <span className="hidden sm:inline">New project</span>
          <span className="sr-only sm:hidden">New project</span>
        </Button>
      </Tooltip>
      <Menu>
        <Tooltip label="More project actions">
          <MenuTrigger
            render={
              <Button
                size="icon"
                aria-label="More project actions"
                className="ml-px rounded-l-none px-0"
              />
            }
          >
            <ChevronDownIcon size={16} strokeWidth={1.5} aria-hidden />
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem onClick={onImport}>
            <UploadIcon size={16} strokeWidth={1.5} aria-hidden />
            Import board
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}

function ProfileMenu({
  email,
  avatarUrl,
  userId,
  onSignOut,
}: {
  email: string | null
  avatarUrl: string | null
  userId: string | null
  onSignOut: () => void
}) {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === "dark" ? "light" : "dark"
  const initial = email?.[0]?.toUpperCase() ?? "?"
  const [apiTokensOpen, setApiTokensOpen] = useState(false)

  return (
    <>
      <Menu>
        <Tooltip label={email ?? "Account menu"}>
          <MenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label="Account menu"
                className="overflow-hidden rounded-full p-0"
              />
            }
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-label text-text-2">{initial}</span>
            )}
          </MenuTrigger>
        </Tooltip>
        <MenuContent>
          {email && <MenuLabel>{email}</MenuLabel>}
          <MenuItem onClick={toggleTheme}>
            {theme === "dark" ? (
              <SunIcon size={16} strokeWidth={1.5} aria-hidden />
            ) : (
              <MoonIcon size={16} strokeWidth={1.5} aria-hidden />
            )}
            Switch to {nextTheme} theme
          </MenuItem>
          <MenuItem onClick={() => setApiTokensOpen(true)}>
            <KeyIcon size={16} strokeWidth={1.5} aria-hidden />
            API Tokens
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={onSignOut}>
            <LogOutIcon size={16} strokeWidth={1.5} aria-hidden />
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>
      {userId && (
        <ApiTokensDialog
          userId={userId}
          open={apiTokensOpen}
          onOpenChange={setApiTokensOpen}
        />
      )}
    </>
  )
}

function ProjectGrid({
  items,
  allowLead,
  stats,
  statsLoading,
  onEdit,
  onDelete,
}: {
  items: ProjectWithRole[]
  allowLead: boolean
  stats: Map<string, ProjectStats> | undefined
  statsLoading: boolean
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}) {
  // Lead card spans two columns so the grid is never three equal towers: DESIGN.md 3.3
  const hasLead = allowLead && items.length >= MIN_PROJECTS_FOR_LEAD_CARD

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((project, i) => {
        const isLead = hasLead && i === 0
        return (
          <div
            key={project.id}
            className={isLead ? "animate-enter md:col-span-2 xl:col-span-2" : "animate-enter"}
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
          >
            <ProjectCard
              project={project}
              isOwner={project.isOwner}
              lead={isLead}
              stats={stats?.get(project.id)}
              statsLoading={statsLoading}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        )
      })}
    </div>
  )
}

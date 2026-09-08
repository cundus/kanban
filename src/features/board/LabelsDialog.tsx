import { useState } from "react"
import { PencilIcon, TagIcon, TrashIcon } from "lucide-react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { LabelBadge } from "@/components/ui/label-badge"
import {
  useLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  type Label,
} from "./useLabels"

interface LabelsDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Dialog to create/edit/delete project labels. */
function LabelsDialog({ projectId, open, onOpenChange }: LabelsDialogProps) {
  const { data: labels, isLoading } = useLabels(projectId)
  const createLabel = useCreateLabel(projectId)
  const updateLabel = useUpdateLabel(projectId)
  const deleteLabel = useDeleteLabel(projectId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("#000000")
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#3b82f6")
  const [pendingDelete, setPendingDelete] = useState<Label | null>(null)

  function startEdit(label: Label) {
    setEditingId(label.id)
    setEditName(label.name)
    setEditColor(label.color)
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return
    updateLabel.mutate(
      { id: editingId, name: editName.trim(), color: editColor },
      { onSuccess: () => setEditingId(null) }
    )
  }

  function handleCreate() {
    if (!newName.trim()) return
    createLabel.mutate(
      { name: newName.trim(), color: newColor },
      { onSuccess: () => { setNewName(""); setNewColor("#3b82f6") } }
    )
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
        </DialogHeader>
        <DialogBody className="gap-2">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : (labels?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<TagIcon size={18} strokeWidth={1.5} aria-hidden />}
              title="Belum ada label"
            />
          ) : (
            labels?.map((label) => (
              <div
                key={label.id}
                className="flex items-center gap-2 rounded-md border border-line px-3 py-2"
              >
                {editingId === label.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                    />
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="size-8 shrink-0 rounded"
                      aria-label="Label color"
                    />
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <LabelBadge name={label.name} color={label.color} />
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${label.name}`}
                      onClick={() => startEdit(label)}
                    >
                      <PencilIcon size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${label.name}`}
                      onClick={() => setPendingDelete(label)}
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </DialogBody>
        <DialogFooter className="flex-row items-center sm:justify-start">
          <Input
            placeholder="New label name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-w-0 flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="size-8 shrink-0 rounded"
            aria-label="New label color"
          />
          <Button onClick={handleCreate} disabled={!newName.trim()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => {
          if (!v) setPendingDelete(null)
        }}
        title={`Delete "${pendingDelete?.name}"?`}
        description="Label ini akan dihapus dari semua task."
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) deleteLabel.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </>
  )
}

export { LabelsDialog }

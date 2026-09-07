import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ExportDocV1 } from "./exportFormat"
import { validateImport } from "./importValidation"
import { useImportProject } from "./useImportProject"

const MAX_FILE_BYTES = 2 * 1024 * 1024

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const importProject = useImportProject()

  const [fileName, setFileName] = useState<string | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [validDoc, setValidDoc] = useState<ExportDocV1 | null>(null)
  const [summary, setSummary] = useState<
    { name: string; lists: number; tasks: number } | null
  >(null)

  // Reset seluruh state tiap kali dialog ditutup / dibuka ulang.
  useEffect(() => {
    if (!open) {
      setFileName(null)
      setParseErrors([])
      setValidDoc(null)
      setSummary(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }, [open])

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseErrors([])
    setValidDoc(null)
    setSummary(null)

    if (file.size > MAX_FILE_BYTES) {
      setParseErrors(["File terlalu besar (maks 2 MB)."])
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      setParseErrors(["File tidak bisa dibaca."])
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setParseErrors(["File bukan JSON yang valid."])
      return
    }

    const result = validateImport(parsed)
    if ("errors" in result) {
      setParseErrors(result.errors)
      return
    }
    setValidDoc(result.doc)
    setSummary({
      name: result.doc.project.name,
      lists: result.doc.lists.length,
      tasks: result.doc.lists.reduce((sum, l) => sum + l.tasks.length, 0),
    })
  }

  function handleImport() {
    if (!validDoc || importProject.isPending) return
    importProject.mutate(validDoc, {
      onSuccess: ({ projectId }) => {
        onOpenChange(false)
        toast.success("Project berhasil di-import.")
        navigate(`/projects/${projectId}`)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import project dari file JSON</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Pilih file JSON untuk di-import"
            className="sr-only"
            onChange={(e) => void onFileChange(e)}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              Pilih file
            </Button>
            <span className="truncate text-sm text-muted-foreground">
              {fileName ?? "Belum ada file dipilih."}
            </span>
          </div>

          {parseErrors.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 rounded-md bg-destructive/10 py-2 pr-3 pl-6 text-sm text-destructive">
              {parseErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}

          {summary && (
            <p className="text-sm text-muted-foreground">
              Akan membuat project baru &ldquo;{summary.name}&rdquo; dengan{" "}
              {summary.lists} list dan {summary.tasks} task.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleImport}
            disabled={!validDoc || importProject.isPending}
          >
            {importProject.isPending ? "Meng-import…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

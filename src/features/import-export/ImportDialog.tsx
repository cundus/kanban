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

  // Reset every field whenever the dialog closes so a reopen starts clean.
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
      setParseErrors(["File is larger than the 2 MB limit."])
      return
    }

    let text: string
    try {
      text = await file.text()
    } catch {
      setParseErrors(["File could not be read."])
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setParseErrors(["File is not valid JSON."])
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
        toast.success("Project imported.")
        navigate(`/projects/${projectId}`)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a project from JSON</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Choose a JSON file to import"
            className="sr-only"
            onChange={(e) => void onFileChange(e)}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            <span className="truncate text-ui text-text-3">
              {fileName ?? "No file selected"}
            </span>
          </div>

          {parseErrors.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 rounded-md border border-danger bg-danger-soft py-2 pr-3 pl-6 text-label text-danger">
              {parseErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}

          {summary && (
            <p className="text-ui text-text-3">
              Creates a new project &ldquo;{summary.name}&rdquo; with{" "}
              <span data-numeric>{summary.lists}</span> lists and{" "}
              <span data-numeric>{summary.tasks}</span> tasks.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleImport}
            disabled={!validDoc || importProject.isPending}
          >
            {importProject.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

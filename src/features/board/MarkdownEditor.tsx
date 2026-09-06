import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { renderMarkdown } from "./markdown"

type Mode = "write" | "preview" | "split"

export function MarkdownEditor({
  value,
  onChange,
  minRows = 8,
}: {
  value: string
  onChange: (v: string) => void
  minRows?: number
}) {
  const [mode, setMode] = useState<Mode>("write")
  const html = renderMarkdown(value)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(["write", "preview", "split"] as Mode[]).map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={mode === m ? "default" : "ghost"}
            className={m === "split" ? "hidden sm:inline-flex" : undefined}
            onClick={() => setMode(m)}
          >
            {m === "write" ? "Write" : m === "preview" ? "Preview" : "Split"}
          </Button>
        ))}
      </div>

      <div className={mode === "split" ? "grid grid-cols-2 gap-3" : undefined}>
        {(mode === "write" || mode === "split") && (
          <Textarea
            rows={minRows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Markdown supported"
          />
        )}
        {(mode === "preview" || mode === "split") && (
          <div
            className="prose prose-sm max-w-none rounded-md border p-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  )
}

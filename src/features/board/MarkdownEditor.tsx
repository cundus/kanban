import { useRef } from "react"
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/kit/core"
import { commonmark } from "@milkdown/kit/preset/commonmark"
import { gfm } from "@milkdown/kit/preset/gfm"
import { history } from "@milkdown/kit/plugin/history"
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener"
import { clipboard } from "@milkdown/kit/plugin/clipboard"
import { cursor } from "@milkdown/kit/plugin/cursor"
import { indent } from "@milkdown/kit/plugin/indent"
import { trailing } from "@milkdown/kit/plugin/trailing"
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react"
import "@milkdown/kit/prose/view/style/prosemirror.css"
import "@milkdown/kit/prose/gapcursor/style/gapcursor.css"
import "./milkdown.css"

/**
 * WYSIWYG markdown editor (Milkdown / ProseMirror). Text is edited as rich
 * content — `# `, `- `, `> `, `**bold**` etc. transform inline as you type —
 * and serialised back to CommonMark + GFM markdown for storage.
 *
 * The editor is uncontrolled: `value` seeds the initial document only. Callers
 * that need to swap the document (e.g. opening a different task) must remount
 * via a `key`, which `TaskDialog` does with the task id.
 */
function MarkdownEditorInner({
  value,
  onChange,
  minRows = 8,
}: {
  value: string
  onChange: (v: string) => void
  minRows?: number
}) {
  // Keep the latest onChange without re-creating the editor, and remember the
  // seed so the initial parse/normalisation pass doesn't register as an edit.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const initialRef = useRef(value)
  const seenFirstUpdate = useRef(false)

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialRef.current)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: {
            ...prev.attributes,
            class: "milkdown-prose",
            style: `min-height:${minRows * 1.5}rem`,
          },
        }))
        ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
          // First fire is Milkdown loading the seed document, not a user edit.
          if (!seenFirstUpdate.current) {
            seenFirstUpdate.current = true
            return
          }
          if (markdown === prevMarkdown || markdown === initialRef.current) return
          onChangeRef.current(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(clipboard)
      .use(cursor)
      .use(indent)
      .use(trailing)
  )

  return (
    <div className="milkdown-wrapper rounded-md border border-line bg-surface-1 focus-within:border-accent-line focus-within:ring-1 focus-within:ring-accent-line">
      <Milkdown />
    </div>
  )
}

export function MarkdownEditor(props: {
  value: string
  onChange: (v: string) => void
  minRows?: number
}) {
  return (
    <MilkdownProvider>
      <MarkdownEditorInner {...props} />
    </MilkdownProvider>
  )
}

// Default export so callers can `lazy(() => import("./MarkdownEditor"))` and
// keep the ProseMirror/Milkdown bundle out of the initial board load.
export default MarkdownEditor

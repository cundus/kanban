import { forwardRef, memo, useImperativeHandle, useRef } from "react"
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx, editorViewCtx, serializerCtx } from "@milkdown/kit/core"
import { Plugin } from "@milkdown/kit/prose/state"
import { $prose } from "@milkdown/kit/utils"
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
 * and serialised back to CommonMark + GFM markdown only when saving.
 *
 * The editor is uncontrolled: `value` seeds the initial document only. Callers
 * that need to swap the document (e.g. opening a different task) must remount
 * via a `key`, which `TaskDialog` does with the task id.
 */
export interface MarkdownEditorHandle {
  getMarkdown: () => string | null
}

interface MarkdownEditorProps {
  value: string
  onDirty: () => void
  minRows?: number
}

const MarkdownEditorInner = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditorInner({
  value,
  onDirty,
  minRows = 8,
}, ref) {
  const onDirtyRef = useRef(onDirty)
  onDirtyRef.current = onDirty
  const initialRef = useRef(value)
  const readyRef = useRef(false)

  const { get } = useEditor((root) =>
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
        ctx.get(listenerCtx).mounted(() => { readyRef.current = true })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(clipboard)
      .use(cursor)
      .use(indent)
      .use(trailing)
      .use($prose(() => new Plugin({
        view: () => ({
          update: (view, previousState) => {
            if (readyRef.current && !view.state.doc.eq(previousState.doc)) {
              onDirtyRef.current()
            }
          },
        }),
      })))
  )

  useImperativeHandle(ref, () => ({
    getMarkdown: () => {
      const editor = get()
      if (!editor || !readyRef.current) return null
      return editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc))
    },
  }), [get])

  return (
    <div className="milkdown-wrapper rounded-md border border-line bg-surface-1 focus-within:border-accent-line focus-within:ring-1 focus-within:ring-accent-line">
      <Milkdown />
    </div>
  )
})

export const MarkdownEditor = memo(forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(props, ref) {
  return (
    <MilkdownProvider>
      <MarkdownEditorInner {...props} ref={ref} />
    </MilkdownProvider>
  )
}))

// Default export so callers can `lazy(() => import("./MarkdownEditor"))` and
// keep the ProseMirror/Milkdown bundle out of the initial board load.
export default MarkdownEditor

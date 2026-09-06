import { marked } from "marked"
import DOMPurify from "dompurify"

/**
 * Render markdown source to sanitized HTML.
 *
 * Since Fase 3 a task description can be authored by another project member, so
 * the `marked` output must pass through DOMPurify before it ever reaches
 * `dangerouslySetInnerHTML`. Both render points (TaskDialog view mode and the
 * MarkdownEditor preview panel) go through this helper so sanitisation stays
 * consistent and testable.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md || "", { async: false }) as string
  return DOMPurify.sanitize(html)
}

import { Profiler, StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { TaskDialog } from "../../src/features/board/TaskDialog"
import type { Database } from "../../src/types/database.types"
import "../../src/index.css"

type Task = Database["public"]["Tables"]["tasks"]["Row"]
const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
for (const key of ["members", "labels", "lists"]) client.setQueryData([key, "test-project"], [])
for (const key of ["task-assignees", "task-labels", "task-images"]) client.setQueryData([key, "test-project"], {})
const imageMode = new URLSearchParams(location.search).get("images")
if (imageMode) {
  const svgUrl = (width: number, height: number, color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`)}`
  const urls: Record<string, string> = {
    landscape: svgUrl(1600, 900, "navy"),
    portrait: svgUrl(900, 1600, "teal"),
    broken: "/tests/fixtures/missing-image.png",
  }
  const paths = imageMode === "single" ? ["landscape"] : ["landscape", "portrait", "broken"]
  client.setQueryData(["task-images", "test-project"], { "task-7": paths.map((path, index) => ({ id: path, task_id: "task-7", project_id: "test-project", storage_path: path, size_bytes: 1024, position: index })) })
  client.setQueryData(["task-image-urls", [...paths].sort()], urls)
  Object.assign(window, { removeFirstViewerImage: () => {
    client.setQueryData(["task-image-urls", paths.slice(1).sort()], urls)
    client.setQueryData(["task-images", "test-project"], { "task-7": paths.slice(1).map((path, index) => ({ id: path, task_id: "task-7", project_id: "test-project", storage_path: path, size_bytes: 1024, position: index })) })
  } })
}
const metrics = { commits: 0 }
Object.assign(window, { editorMetrics: metrics })

function Fixture() {
  const [task, setTask] = useState<Task>({ id: "task-7", project_id: "test-project", serial_number: 7, title: "Description editor", description_md: "Test description", due_date: null, created_by: "test-user", updated_at: new Date().toISOString(), created_at: new Date().toISOString(), archived_at: null, position: 1, list_id: "todo" })
  Object.assign(window, {
    switchEditorTask: (description: string) => setTask(previous => ({ ...previous, id: `${previous.id}-next`, description_md: description })),
    refreshEditorTask: (description: string) => setTask(previous => ({ ...previous, description_md: description })),
  })
  return <Profiler id="task-dialog" onRender={() => { metrics.commits++ }}><TaskDialog task={task} projectId="test-project" open onOpenChange={() => {}} /></Profiler>
}

createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><Fixture /><Toaster /></QueryClientProvider></StrictMode>)

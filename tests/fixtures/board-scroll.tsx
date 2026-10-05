import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { BoardPage } from "../../src/features/board/BoardPage"
import "../../src/index.css"

const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
const lists = ["Todo", "Progress", "Done"].map((name, index) => ({ id: `list-${index}`, name, position: index, project_id: "test-project" }))
const tasks = lists.flatMap((list, listIndex) => Array.from({ length: listIndex === 2 ? 0 : 40 }, (_, index) => ({ id: `${list.id}-task-${index}`, project_id: "test-project", list_id: list.id, title: `${list.name} task ${index + 1}`, serial_number: listIndex * 40 + index + 1, description_md: null, due_date: null, archived_at: null, position: (index + 1) * 1024, created_by: "test-user", created_at: new Date().toISOString(), updated_at: new Date().toISOString() })))
client.setQueryData(["lists", "test-project"], lists)
client.setQueryData(["tasks", "test-project"], tasks)
client.setQueryData(["tasks", "test-project", "archived"], [])
client.setQueryData(["project", "test-project"], { id: "test-project", name: "Board scroll regression" })
for (const key of ["members", "labels"]) client.setQueryData([key, "test-project"], [])
for (const key of ["task-assignees", "task-labels", "task-images"]) client.setQueryData([key, "test-project"], {})
Object.assign(window, { boardFixture: { tasks, lists } })
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><MemoryRouter initialEntries={["/projects/test-project"]}><Routes><Route path="/projects/:id" element={<BoardPage />} /></Routes></MemoryRouter></QueryClientProvider></StrictMode>)

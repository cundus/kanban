import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { LoginPage } from "@/features/auth/LoginPage"
import { AuthGuard } from "@/features/auth/AuthGuard"
import { ProjectListPage } from "@/features/projects/ProjectListPage"
import { BoardPage } from "@/features/board/BoardPage"

export function App() {
  return (
    <BrowserRouter>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <ProjectListPage />
            </AuthGuard>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <AuthGuard>
              <BoardPage />
            </AuthGuard>
          }
        />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </BrowserRouter>
  )
}

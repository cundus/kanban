import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import "./index.css"
import { App } from "./App"

// Dev-only inspection tooling. Dynamic import so it never enters the prod bundle.
// react-doctor is CLI-only: `pnpm exec react-doctor`.
if (import.meta.env.DEV) {
  void import("react-scan").then(({ scan }) => scan({ enabled: true }))
  void import("grab").then(({ init }) => init())
  void import("grab/styles.css")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)

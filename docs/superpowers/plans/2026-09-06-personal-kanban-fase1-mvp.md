# Personal Kanban — Fase 1 (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user Personal Kanban MVP — Google login, CRUD for projects/lists/tasks, manual up/down reordering, markdown task descriptions (edit as raw text, render as HTML on view) — deployable as a pure static build with Supabase as the only backend.

**Architecture:** React 18 + Vite SPA talking directly to Supabase (Postgres + Auth + RLS) via `@supabase/supabase-js`. No custom backend server — all authorization enforced by Postgres RLS policies keyed on `auth.uid()`. TanStack Query manages all server-state caching/mutations. React Router handles `/login`, `/`, `/projects/:id`.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, React Router, Supabase (`supabase-js`), `marked`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-personal-kanban-fase1-design.md`

---

## Task 0: Prerequisites (manual, non-code)

No files touched. Must be done before Task 1 because later tasks need real credentials.

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com/dashboard → New Project. Note the **Project URL** and **anon public key** from Settings → API. You'll need these in Task 4.

- [ ] **Step 2: Enable Google OAuth provider**

In Supabase Dashboard → Authentication → Providers → Google:
1. Create OAuth credentials in Google Cloud Console (APIs & Services → Credentials → OAuth Client ID → Web application).
2. Set Authorized redirect URI to the value shown in the Supabase Google provider panel (format: `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Paste the Google Client ID and Client Secret into the Supabase Google provider panel and enable it.

Expected: Google provider shows "Enabled" in Supabase dashboard.

---

## Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`

- [ ] **Step 1: Run Vite scaffold in the existing project directory**

Run:
```bash
pnpm create vite@latest . -- --template react-ts
```

The directory already has `docs/`, `.git`, `.gitignore` — Vite will ask `Current directory is not empty. Remove existing files and continue?`. Choose **No** (do not remove existing files) — it will merge and only write template files that don't conflict. If it aborts instead, manually copy the `react-ts` template files (`package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/`) from a temp scaffold.

- [ ] **Step 2: Install dependencies**

Run:
```bash
pnpm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Verify dev server boots**

Run:
```bash
pnpm dev
```

Expected: Vite prints `Local: http://localhost:5173/`. Stop with Ctrl+C once confirmed.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json index.html src/
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Configure Tailwind CSS v4 + shadcn/ui

**Files:**
- Modify: `src/index.css`, `tsconfig.json`, `tsconfig.app.json`, `vite.config.ts`
- Create: `components.json`, `src/lib/utils.ts`

- [ ] **Step 1: Install Tailwind v4**

```bash
pnpm add tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Replace src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 3: Add path alias to tsconfig.json**

Add `compilerOptions.baseUrl` and `compilerOptions.paths` to `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Add path alias to tsconfig.app.json**

Add the same `baseUrl`/`paths` inside `compilerOptions` of `tsconfig.app.json` (keep existing options, just add these two keys).

- [ ] **Step 5: Install @types/node and update vite.config.ts**

```bash
pnpm add -D @types/node
```

```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

- [ ] **Step 6: Run shadcn/ui init**

```bash
pnpm dlx shadcn@latest init
```

If prompted, accept defaults: style = default, base color = neutral, CSS variables = yes. This creates `components.json` and `src/lib/utils.ts` (the `cn()` helper).

- [ ] **Step 7: Verify build**

```bash
pnpm build
```

Expected: exits 0, `dist/` created.

- [ ] **Step 8: Commit**

```bash
git add src/index.css tsconfig.json tsconfig.app.json vite.config.ts components.json src/lib/utils.ts package.json pnpm-lock.yaml
git commit -m "chore: configure Tailwind CSS v4 and shadcn/ui"
```

---

## Task 3: Install remaining dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm add @supabase/supabase-js @tanstack/react-query react-router-dom marked
```

- [ ] **Step 2: Verify install**

Run:
```bash
pnpm list @supabase/supabase-js @tanstack/react-query react-router-dom marked
```

Expected: all four listed with version numbers, no `UNMET DEPENDENCY`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add supabase-js, tanstack query, react-router-dom, marked"
```

---

## Task 4: Environment variables

**Files:**
- Create: `.env.example`
- Create (not committed — already gitignored): `.env.local`

- [ ] **Step 1: Create .env.example**

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- [ ] **Step 2: Create .env.local with real values**

Copy `.env.example` to `.env.local` and fill in the Project URL and anon key from Task 0 Step 1. This file is already covered by the root `.gitignore` (`.env*` pattern) — do not commit it.

- [ ] **Step 3: Verify gitignore covers it**

Run:
```bash
git status --short
```

Expected: `.env.local` does NOT appear in the output (ignored).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add env var example for supabase credentials"
```

---

## Task 5: Database types

**Files:**
- Create: `src/types/database.types.ts`

- [ ] **Step 1: Write hand-authored types matching the Fase 1 schema**

```typescript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
        }
      }
      lists: {
        Row: {
          id: string
          project_id: string
          name: string
          position: number
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          position: number
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          position?: number
        }
      }
      tasks: {
        Row: {
          id: string
          list_id: string
          project_id: string
          title: string
          description_md: string | null
          due_date: string | null
          position: number
          created_by: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          project_id: string
          title: string
          description_md?: string | null
          due_date?: string | null
          position: number
          created_by: string
          updated_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          project_id?: string
          title?: string
          description_md?: string | null
          due_date?: string | null
          position?: number
          created_by?: string
          updated_at?: string
        }
      }
    }
  }
}
```

> `ponytail:` hand-written types, ceiling = drift from real schema if migrations change without updating this file. Upgrade: once Supabase CLI is linked to the project, replace with `supabase gen types typescript --project-id <ref> > src/types/database.types.ts`.

- [ ] **Step 2: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat: add hand-authored database types for Fase 1 schema"
```

---

## Task 6: Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Write the client**

```typescript
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check .env.local"
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Declare Vite env types**

Ensure `src/vite-env.d.ts` (created by Vite scaffold) contains `/// <reference types="vite/client" />`. If it also needs typed env vars, append:

```typescript
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts src/vite-env.d.ts
git commit -m "feat: add supabase client"
```

---

## Task 7: TanStack Query client

**Files:**
- Create: `src/lib/queryClient.ts`

- [ ] **Step 1: Write the query client**

```typescript
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queryClient.ts
git commit -m "feat: add tanstack query client"
```

---

## Task 8: Database migration (schema + RLS)

**Files:**
- Create: `supabase/migrations/20260906000000_init_schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "Owners can select own projects"
  on projects for select
  using (auth.uid() = owner_id);

create policy "Owners can insert own projects"
  on projects for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update own projects"
  on projects for update
  using (auth.uid() = owner_id);

create policy "Owners can delete own projects"
  on projects for delete
  using (auth.uid() = owner_id);

-- lists
create table lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position integer not null default 0
);

alter table lists enable row level security;

create policy "Owners can select own lists"
  on lists for select
  using (exists (select 1 from projects where projects.id = lists.project_id and projects.owner_id = auth.uid()));

create policy "Owners can insert own lists"
  on lists for insert
  with check (exists (select 1 from projects where projects.id = lists.project_id and projects.owner_id = auth.uid()));

create policy "Owners can update own lists"
  on lists for update
  using (exists (select 1 from projects where projects.id = lists.project_id and projects.owner_id = auth.uid()));

create policy "Owners can delete own lists"
  on lists for delete
  using (exists (select 1 from projects where projects.id = lists.project_id and projects.owner_id = auth.uid()));

-- tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description_md text,
  due_date date,
  position integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Owners can select own tasks"
  on tasks for select
  using (exists (select 1 from projects where projects.id = tasks.project_id and projects.owner_id = auth.uid()));

create policy "Owners can insert own tasks"
  on tasks for insert
  with check (exists (select 1 from projects where projects.id = tasks.project_id and projects.owner_id = auth.uid()));

create policy "Owners can update own tasks"
  on tasks for update
  using (exists (select 1 from projects where projects.id = tasks.project_id and projects.owner_id = auth.uid()));

create policy "Owners can delete own tasks"
  on tasks for delete
  using (exists (select 1 from projects where projects.id = tasks.project_id and projects.owner_id = auth.uid()));

-- auto-create profile row on signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Apply the migration**

In Supabase Dashboard → SQL Editor, paste the full SQL above and run it. Expected: `Success. No rows returned.` and the 4 tables (`profiles`, `projects`, `lists`, `tasks`) appear in Table Editor with RLS shown as enabled (lock icon).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260906000000_init_schema.sql
git commit -m "feat: add Fase 1 database schema and RLS policies"
```

---

## Task 9: Reorder utility (non-trivial logic + self-check)

**Files:**
- Create: `src/features/board/reorderUtils.ts`
- Create: `src/features/board/reorderUtils.selfcheck.ts`

- [ ] **Step 1: Write the pure reorder function**

```typescript
export interface Positioned {
  id: string
  position: number
}

/**
 * Given a position-sorted list and the index of the item to move,
 * returns the two items with swapped `position` values, or null if
 * the move is out of bounds (already at the top/bottom).
 */
export function swapPosition<T extends Positioned>(
  items: T[],
  index: number,
  direction: "up" | "down"
): [T, T] | null {
  const targetIndex = direction === "up" ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= items.length) return null

  const current = items[index]
  const target = items[targetIndex]

  return [
    { ...current, position: target.position },
    { ...target, position: current.position },
  ]
}
```

- [ ] **Step 2: Write the self-check script**

```typescript
import { swapPosition, type Positioned } from "./reorderUtils"

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`)
    process.exit(1)
  }
  console.log(`PASS: ${label}`)
}

const items: Positioned[] = [
  { id: "a", position: 0 },
  { id: "b", position: 1 },
  { id: "c", position: 2 },
]

assertEqual(
  swapPosition(items, 1, "up"),
  [
    { id: "b", position: 0 },
    { id: "a", position: 1 },
  ],
  "swap middle item up"
)

assertEqual(
  swapPosition(items, 1, "down"),
  [
    { id: "b", position: 2 },
    { id: "c", position: 1 },
  ],
  "swap middle item down"
)

assertEqual(swapPosition(items, 0, "up"), null, "top item cannot move up")
assertEqual(
  swapPosition(items, 2, "down"),
  null,
  "bottom item cannot move down"
)

console.log("All reorderUtils self-checks passed.")
```

- [ ] **Step 3: Run the self-check**

```bash
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: 4 `PASS:` lines then `All reorderUtils self-checks passed.`, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/board/reorderUtils.ts src/features/board/reorderUtils.selfcheck.ts
git commit -m "feat: add position swap utility with self-check"
```

---

## Task 10: Auth feature

**Files:**
- Create: `src/features/auth/useAuth.ts`
- Create: `src/features/auth/AuthGuard.tsx`
- Create: `src/features/auth/LoginPage.tsx`

- [ ] **Step 1: Write useAuth hook**

```typescript
import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  function signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }

  function signOut() {
    return supabase.auth.signOut()
  }

  return { session, isLoading, signInWithGoogle, signOut }
}
```

- [ ] **Step 2: Write AuthGuard**

```tsx
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./useAuth"

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 3: Write LoginPage (requires shadcn Button — added in Task 12; write the file now, it will typecheck once Task 12 runs)**

```tsx
import { Button } from "@/components/ui/button"
import { useAuth } from "./useAuth"

export function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Personal Kanban</h1>
      <Button onClick={() => signInWithGoogle()}>Login with Google</Button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/
git commit -m "feat: add auth hook, guard, and login page"
```

---

## Task 11: App shell, routing, and providers

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Wire providers in main.tsx**

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import "./index.css"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
```

- [ ] **Step 2: Write App.tsx with routes**

> `ponytail:` route definitions live inline in `App.tsx` instead of a separate `src/routes/` folder — only 3 routes exist in Fase 1. Upgrade: extract to `src/routes/` once route count or nesting grows (Fase 3+ with member views, etc).

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { LoginPage } from "@/features/auth/LoginPage"
import { AuthGuard } from "@/features/auth/AuthGuard"
import { ProjectListPage } from "@/features/projects/ProjectListPage"
import { BoardPage } from "@/features/board/BoardPage"

export function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: wire query provider and router"
```

(This will not typecheck until Tasks 12-16 create `ProjectListPage` and `BoardPage` — that's expected; commit anyway per frequent-commits discipline, final typecheck happens in Task 18.)

---

## Task 12: Add required shadcn/ui components

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/label.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/card.tsx`

- [ ] **Step 1: Add components via CLI**

```bash
pnpm dlx shadcn@latest add button input textarea label dialog card
```

Expected: 6 files created under `src/components/ui/`, `package.json` gains `@radix-ui/*` and `lucide-react` deps.

- [ ] **Step 2: Verify install**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors related to `@/components/ui/*` imports (unrelated errors from missing `ProjectListPage`/`BoardPage` are expected at this point — ignore for now).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ package.json pnpm-lock.yaml components.json
git commit -m "feat: add shadcn button, input, textarea, label, dialog, card"
```

---

## Task 13: Projects feature

**Files:**
- Create: `src/features/projects/useProjects.ts`
- Create: `src/features/projects/ProjectCard.tsx`
- Create: `src/features/projects/ProjectListPage.tsx`

- [ ] **Step 1: Write useProjects hook (list + create + update + delete)**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

const PROJECTS_KEY = ["projects"] as const

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as Project[]
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description: string | null }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated")

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: input.name,
          description: input.description,
          owner_id: userData.user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; description: string | null }) => {
      const { data, error } = await supabase
        .from("projects")
        .update({ name: input.name, description: input.description })
        .eq("id", input.id)
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY })
    },
  })
}
```

- [ ] **Step 2: Write ProjectCard**

```tsx
import { useNavigate } from "react-router-dom"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
        {project.description && (
          <CardDescription>{project.description}</CardDescription>
        )}
      </CardHeader>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(`/projects/${project.id}`)}>
          Open
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onEdit(project)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => onDelete(project.id)}>
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 3: Write ProjectListPage**

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ProjectCard } from "./ProjectCard"
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "./useProjects"
import { useAuth } from "@/features/auth/useAuth"
import type { Database } from "@/types/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"]

export function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const { signOut } = useAuth()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  function openCreateDialog() {
    setEditing(null)
    setName("")
    setDescription("")
    setDialogOpen(true)
  }

  function openEditDialog(project: Project) {
    setEditing(project)
    setName(project.name)
    setDescription(project.description ?? "")
    setDialogOpen(true)
  }

  function handleSave() {
    if (editing) {
      updateProject.mutate(
        { id: editing.id, name, description: description || null },
        { onSuccess: () => setDialogOpen(false) }
      )
    } else {
      createProject.mutate(
        { name, description: description || null },
        { onSuccess: () => setDialogOpen(false) }
      )
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Projects</h1>
        <div className="flex gap-2">
          <Button onClick={openCreateDialog}>New Project</Button>
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={openEditDialog}
            onDelete={(id) => deleteProject.mutate(id)}
          />
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/
git commit -m "feat: add project CRUD hooks, card, and list page"
```

---

## Task 14: Board feature — lists

**Files:**
- Create: `src/features/board/useLists.ts`
- Create: `src/features/board/ListColumn.tsx`

- [ ] **Step 1: Write useLists hook (query + create + rename + delete + reorder)**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { swapPosition } from "./reorderUtils"

type List = Database["public"]["Tables"]["lists"]["Row"]

function listsKey(projectId: string) {
  return ["lists", projectId] as const
}

export function useLists(projectId: string) {
  return useQuery({
    queryKey: listsKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("project_id", projectId)
        .order("position", { ascending: true })
      if (error) throw error
      return data as List[]
    },
  })
}

export function useCreateList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const existing = queryClient.getQueryData<List[]>(listsKey(projectId)) ?? []
      const nextPosition = existing.length > 0 ? Math.max(...existing.map((l) => l.position)) + 1 : 0

      const { data, error } = await supabase
        .from("lists")
        .insert({ project_id: projectId, name, position: nextPosition })
        .select()
        .single()
      if (error) throw error
      return data as List
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

export function useRenameList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await supabase
        .from("lists")
        .update({ name: input.name })
        .eq("id", input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

export function useDeleteList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lists").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}

export function useReorderList(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { listId: string; direction: "up" | "down" }) => {
      const lists = queryClient.getQueryData<List[]>(listsKey(projectId)) ?? []
      const index = lists.findIndex((l) => l.id === input.listId)
      const swapped = swapPosition(lists, index, input.direction)
      if (!swapped) return

      const [a, b] = swapped
      const { error } = await supabase.from("lists").upsert([a, b])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listsKey(projectId) })
    },
  })
}
```

- [ ] **Step 2: Write ListColumn component**

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Database } from "@/types/database.types"
import { TaskCard } from "./TaskCard"
import { useDeleteList, useRenameList, useReorderList } from "./useLists"
import { useCreateTask, useTasks } from "./useTasks"

type List = Database["public"]["Tables"]["lists"]["Row"]

export function ListColumn({
  list,
  projectId,
  isFirst,
  isLast,
  onOpenTask,
}: {
  list: List
  projectId: string
  isFirst: boolean
  isLast: boolean
  onOpenTask: (taskId: string) => void
}) {
  const { data: tasks } = useTasks(list.id)
  const createTask = useCreateTask(list.id)
  const renameList = useRenameList(projectId)
  const deleteList = useDeleteList(projectId)
  const reorderList = useReorderList(projectId)

  const [isEditingName, setIsEditingName] = useState(false)
  const [name, setName] = useState(list.name)
  const [newTaskTitle, setNewTaskTitle] = useState("")

  function handleRename() {
    if (name.trim() && name !== list.name) {
      renameList.mutate({ id: list.id, name })
    }
    setIsEditingName(false)
  }

  function handleAddTask() {
    if (!newTaskTitle.trim()) return
    createTask.mutate(newTaskTitle, {
      onSuccess: () => setNewTaskTitle(""),
    })
  }

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        {isEditingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
        ) : (
          <h3
            className="cursor-pointer truncate font-medium"
            onClick={() => setIsEditingName(true)}
          >
            {list.name}
          </h3>
        )}
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={isFirst}
            onClick={() => reorderList.mutate({ listId: list.id, direction: "up" })}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isLast}
            onClick={() => reorderList.mutate({ listId: list.id, direction: "down" })}
          >
            ↓
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteList.mutate(list.id)}>
            ✕
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tasks?.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            listId={list.id}
            isFirst={index === 0}
            isLast={index === (tasks.length ?? 1) - 1}
            onOpen={() => onOpenTask(task.id)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New task title"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
        />
        <Button size="sm" onClick={handleAddTask}>
          Add
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/board/useLists.ts src/features/board/ListColumn.tsx
git commit -m "feat: add list CRUD hooks and ListColumn component"
```

---

## Task 15: Board feature — tasks

**Files:**
- Create: `src/features/board/useTasks.ts`
- Create: `src/features/board/TaskCard.tsx`
- Create: `src/features/board/TaskDialog.tsx`

- [ ] **Step 1: Write useTasks hook (query + create + update + delete + reorder)**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"
import { swapPosition } from "./reorderUtils"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

function tasksKey(listId: string) {
  return ["tasks", listId] as const
}

export function useTasks(listId: string) {
  return useQuery({
    queryKey: tasksKey(listId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("list_id", listId)
        .order("position", { ascending: true })
      if (error) throw error
      return data as Task[]
    },
  })
}

export function useCreateTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (title: string) => {
      const { data: listRow, error: listError } = await supabase
        .from("lists")
        .select("project_id")
        .eq("id", listId)
        .single()
      if (listError) throw listError

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError ?? new Error("Not authenticated")

      const existing = queryClient.getQueryData<Task[]>(tasksKey(listId)) ?? []
      const nextPosition = existing.length > 0 ? Math.max(...existing.map((t) => t.position)) + 1 : 0

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          list_id: listId,
          project_id: listRow.project_id,
          title,
          position: nextPosition,
          created_by: userData.user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

export function useUpdateTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      title: string
      description_md: string | null
      due_date: string | null
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: input.title,
          description_md: input.description_md,
          due_date: input.due_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

export function useDeleteTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}

export function useReorderTask(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; direction: "up" | "down" }) => {
      const tasks = queryClient.getQueryData<Task[]>(tasksKey(listId)) ?? []
      const index = tasks.findIndex((t) => t.id === input.taskId)
      const swapped = swapPosition(tasks, index, input.direction)
      if (!swapped) return

      const [a, b] = swapped
      const { error } = await supabase.from("tasks").upsert([a, b])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksKey(listId) })
    },
  })
}
```

- [ ] **Step 2: Write TaskCard**

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/types/database.types"
import { useReorderTask } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskCard({
  task,
  listId,
  isFirst,
  isLast,
  onOpen,
}: {
  task: Task
  listId: string
  isFirst: boolean
  isLast: boolean
  onOpen: () => void
}) {
  const reorderTask = useReorderTask(listId)

  return (
    <Card className="cursor-pointer" onClick={onOpen}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
        <CardTitle className="text-sm font-normal">{task.title}</CardTitle>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            disabled={isFirst}
            onClick={() => reorderTask.mutate({ taskId: task.id, direction: "up" })}
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isLast}
            onClick={() => reorderTask.mutate({ taskId: task.id, direction: "down" })}
          >
            ↓
          </Button>
        </div>
      </CardHeader>
    </Card>
  )
}
```

- [ ] **Step 3: Write TaskDialog (markdown view/edit toggle)**

```tsx
import { useEffect, useState } from "react"
import { marked } from "marked"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { Database } from "@/types/database.types"
import { useDeleteTask, useUpdateTask } from "./useTasks"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

export function TaskDialog({
  task,
  listId,
  open,
  onOpenChange,
}: {
  task: Task | null
  listId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateTask = useUpdateTask(listId)
  const deleteTask = useDeleteTask(listId)

  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [descriptionMd, setDescriptionMd] = useState("")
  const [dueDate, setDueDate] = useState("")

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescriptionMd(task.description_md ?? "")
      setDueDate(task.due_date ?? "")
      setIsEditing(false)
    }
  }, [task])

  if (!task) return null

  function handleSave() {
    if (!task) return
    updateTask.mutate(
      {
        id: task.id,
        title,
        description_md: descriptionMd || null,
        due_date: dueDate || null,
      },
      { onSuccess: () => setIsEditing(false) }
    )
  }

  function handleDelete() {
    if (!task) return
    deleteTask.mutate(task.id, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          {isEditing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <DialogTitle>{task.title}</DialogTitle>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Due date</label>
            {isEditing ? (
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            ) : (
              <p className="text-sm">{task.due_date ?? "No due date"}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Description</label>
            {isEditing ? (
              <Textarea
                rows={8}
                value={descriptionMd}
                onChange={(e) => setDescriptionMd(e.target.value)}
                placeholder="Markdown supported"
              />
            ) : task.description_md ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: marked.parse(task.description_md) as string }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No description</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleDelete}>
            Delete task
          </Button>
          {isEditing ? (
            <Button onClick={handleSave}>Save</Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/board/useTasks.ts src/features/board/TaskCard.tsx src/features/board/TaskDialog.tsx
git commit -m "feat: add task CRUD hooks, card, and markdown detail dialog"
```

---

## Task 16: BoardPage assembly

**Files:**
- Create: `src/features/board/BoardPage.tsx`

- [ ] **Step 1: Write BoardPage**

```tsx
import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ListColumn } from "./ListColumn"
import { TaskDialog } from "./TaskDialog"
import { useCreateList, useLists } from "./useLists"
import { useTasks } from "./useTasks"

export function BoardPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!projectId) {
    navigate("/")
    return null
  }

  const { data: lists, isLoading } = useLists(projectId)
  const createList = useCreateList(projectId)

  const [newListName, setNewListName] = useState("")
  const [openTask, setOpenTask] = useState<{ taskId: string; listId: string } | null>(null)

  function handleAddList() {
    if (!newListName.trim()) return
    createList.mutate(newListName, { onSuccess: () => setNewListName("") })
  }

  return (
    <div className="flex h-svh flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/")}>
          ← Back to projects
        </Button>
        <div className="flex gap-2">
          <Input
            placeholder="New list name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddList()}
          />
          <Button onClick={handleAddList}>Add list</Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="flex flex-1 gap-4 overflow-x-auto">
        {lists?.map((list, index) => (
          <ListColumn
            key={list.id}
            list={list}
            projectId={projectId}
            isFirst={index === 0}
            isLast={index === (lists.length ?? 1) - 1}
            onOpenTask={(taskId) => setOpenTask({ taskId, listId: list.id })}
          />
        ))}
      </div>

      {openTask && (
        <TaskDialogForOpenTask
          taskId={openTask.taskId}
          listId={openTask.listId}
          onOpenChange={(open) => !open && setOpenTask(null)}
        />
      )}
    </div>
  )
}

function TaskDialogForOpenTask({
  taskId,
  listId,
  onOpenChange,
}: {
  taskId: string
  listId: string
  onOpenChange: (open: boolean) => void
}) {
  const { data: tasks } = useTasks(listId)
  const task = tasks?.find((t) => t.id === taskId) ?? null

  return (
    <TaskDialog task={task} listId={listId} open={!!task} onOpenChange={onOpenChange} />
  )
}
```

- [ ] **Step 2: Full typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: exits 0 (all pages now exist, `App.tsx` imports resolve).

- [ ] **Step 3: Commit**

```bash
git add src/features/board/BoardPage.tsx
git commit -m "feat: assemble board page with lists and task dialog"
```

---

## Task 17: Documentation scaffolding

**Files:**
- Create: `docs/PROGRESS.md`
- Create: `CHANGELOG.md`
- Create: `docs/MEMORY.md`

- [ ] **Step 1: Write docs/PROGRESS.md**

```markdown
# Progress Tracker

## Fase 1 — MVP
Plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase1-mvp.md
Status: in-progress

- [x] Task 0: Prerequisites (Supabase project + Google OAuth)
- [x] Task 1: Scaffold Vite + React + TypeScript
- [x] Task 2: Tailwind v4 + shadcn/ui
- [x] Task 3: Remaining dependencies
- [x] Task 4: Environment variables
- [x] Task 5: Database types
- [x] Task 6: Supabase client
- [x] Task 7: TanStack Query client
- [x] Task 8: Database migration + RLS
- [x] Task 9: Reorder utility + self-check
- [x] Task 10: Auth feature
- [x] Task 11: App shell + routing
- [x] Task 12: shadcn components
- [x] Task 13: Projects feature
- [x] Task 14: Board feature — lists
- [x] Task 15: Board feature — tasks
- [x] Task 16: BoardPage assembly
- [x] Task 17: Documentation scaffolding
- [ ] Task 18: Final verification
```

- [ ] **Step 2: Write CHANGELOG.md**

```markdown
# Changelog

## [Fase 1] - 2026-09-06
### Added
- Login via Google (Supabase Auth)
- Project CRUD (create/read/update/delete)
- List CRUD with manual up/down reordering
- Task CRUD with manual up/down reordering
- Task description supports Markdown (edit as raw text, rendered as HTML when viewing)
```

- [ ] **Step 3: Write docs/MEMORY.md**

```markdown
# Memory — Cross-Session Context

## Key Decisions
- **Position column is INTEGER in Fase 1**, not fractional index. Reorder = swap position value with neighbor via `swapPosition()` in `src/features/board/reorderUtils.ts`. Upgrade path to fractional index + drag-drop is Fase 2 — see spec §4.
- **No `project_members` table in Fase 1.** RLS checks `projects.owner_id = auth.uid()` directly. Multi-user support (invite member) is Fase 3 — will require a new migration adding `project_members` and rewriting RLS policies to check membership instead of ownership.
- **No formal test framework in Fase 1.** Manual verification only, except for non-trivial pure logic (`reorderUtils.ts`) which has an assert-based self-check runnable via `pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts`.
- **Route definitions live inline in `src/App.tsx`**, not a separate `src/routes/` folder — only 3 routes exist. Revisit if routing grows in Fase 3+.
- **Mutations use invalidate-on-success, not optimistic updates**, even though TanStack Query was chosen partly to enable optimistic updates later. Fase 1 doesn't need the complexity; add `onMutate`/`onError` rollback when drag-drop (Fase 2) needs instant visual feedback.
- **No toast library added.** Errors from mutations are not yet surfaced to the user beyond default TanStack Query error state (not wired to UI). Add error UI (or `sonner` toast) if this becomes a problem in QA.

## Deferred (deliberately, not forgotten)
- Drag & drop, fractional index — Fase 2
- Markdown live split-view editor — Fase 2
- Invite member, multi-user RLS (`project_members`) — Fase 3
- Import/export JSON — Fase 4
- Due date reminders, labels, dark mode, attachments, activity log — Fase 5

## Conventions
- Feature-based folders: `src/features/{auth,projects,board}/`
- One hook per Supabase table operation (query/create/update/delete/reorder), all via TanStack Query
- shadcn/ui components live untouched in `src/components/ui/`; compose them in feature files
- Package manager: pnpm only (do not use npm/yarn lockfiles)

## Related Docs
- PRD: docs/PRD-Personal-Kanban-App.md
- Fase 1 spec: docs/superpowers/specs/2026-09-06-personal-kanban-fase1-design.md
- Fase 1 plan: docs/superpowers/plans/2026-09-06-personal-kanban-fase1-mvp.md
```

- [ ] **Step 4: Commit**

```bash
git add docs/PROGRESS.md CHANGELOG.md docs/MEMORY.md
git commit -m "docs: add progress tracker, changelog, and memory doc for Fase 1"
```

---

## Task 18: Final verification

No new files. Verification only.

- [ ] **Step 1: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2: Production build (proves pure static output for VPS)**

```bash
pnpm build
```

Expected: exit 0, `dist/` contains static HTML/JS/CSS only — no server process required.

- [ ] **Step 3: Reorder self-check**

```bash
pnpm dlx tsx src/features/board/reorderUtils.selfcheck.ts
```

Expected: all 4 `PASS:` lines, exit 0.

- [ ] **Step 4: Manual end-to-end walkthrough**

```bash
pnpm dev
```

Open http://localhost:5173 and verify:
1. Redirected to `/login` when not authenticated.
2. "Login with Google" completes OAuth and redirects to `/`.
3. Create a project → appears in grid.
4. Open project → board loads with no lists.
5. Add a list → appears as column.
6. Add two tasks to the list → both appear as cards.
7. Reorder tasks with ↑/↓ → order persists after page refresh.
8. Open a task, switch to edit, write `**bold** and _italic_` in description, save.
9. Reopen task in view mode → description renders as bold/italic HTML, not raw markdown.
10. Delete task, delete list, delete project → all disappear and no console errors.

- [ ] **Step 5: RLS isolation check (two Google accounts)**

Log in with a second Google account (different browser profile or incognito). Verify the second account sees an empty project list — cannot see the first account's projects. This confirms RLS policies from Task 8 are enforced correctly.

- [ ] **Step 6: Update docs/PROGRESS.md**

Mark Task 18 as `[x]` and change `Status: in-progress` to `Status: done` in `docs/PROGRESS.md`.

- [ ] **Step 7: Final commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: mark Fase 1 MVP complete"
```

---

## Self-Review Notes

- **Spec coverage:** §1 (login/CRUD/manual order/markdown) → Tasks 10-16. §2 (tech stack) → Tasks 1-3. §3 (folder structure) → matches except `src/routes/` intentionally folded into `App.tsx` (documented deviation, Task 11). §4 (data model + RLS) → Task 8. §5 (flow) → Tasks 10, 13, 16. §6 (out of scope) → nothing in this plan implements drag-drop/fractional-index/invite/import-export. §7 (dev rules: plan/progress/changelog/memory) → Task 17 + this plan file itself satisfies §7.1. §8 (success criteria) → Task 18.
- **Placeholder scan:** no TBD/TODO; all code blocks are complete and runnable.
- **Type consistency:** `Positioned`/`swapPosition` signature used identically in `useLists.ts` and `useTasks.ts`. `Database["public"]["Tables"][...]["Row"]` type aliases used consistently across all feature files.

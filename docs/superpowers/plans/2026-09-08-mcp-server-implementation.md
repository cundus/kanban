# MCP Server Implementation Plan

**For agentic workers**: This plan is written for a mid-level executor model (e.g. Claude Sonnet 4.6 / Kimi 2.7). Every step below includes concrete pseudocode/code for all branches — do not improvise architecture, do not skip steps, do not leave `// TODO` placeholders. If something in this plan is ambiguous or contradicts the actual codebase state at execution time, STOP and ask rather than guessing.

**Spec**: `docs/superpowers/specs/2026-09-08-mcp-server-design.md` (153 lines, source of truth for scope/non-scope).

## Goal

Ship an MCP (Model Context Protocol) server so AI coding agents (Claude Code, OpenCode) can read/write kanban data (projects, lists, labels, tasks) directly from CLI/IDE via bearer-token-authenticated HTTP, plus a web-app UI for users to generate/revoke their own API tokens.

## Architecture

```
AI Agent (Claude Code / OpenCode)
   │  HTTP POST /mcp  (Authorization: Bearer kbn_xxxxx)
   ▼
mcp-server/  (standalone Node process, new subdomain e.g. mcp.cundus.my.id)
   ├─ Hono app (@hono/node-server)
   ├─ auth middleware → SHA-256 hash lookup in mcp_tokens → attach userId to context
   ├─ rate limit middleware → in-memory Map, ~60 req/min per token
   ├─ McpServer (StreamableHTTPServerTransport, stateless mode)
   │    └─ tools/{project,list,label,task}.ts
   │         each tool calls assertProjectMember(userId, projectId) FIRST
   ├─ db.ts → single shared Supabase client using SERVICE_ROLE key (bypasses RLS —
   │            assertProjectMember is the ONLY authorization gate)
   └─ keepalive.ts → setInterval, ping DB every 3 days (prevent Supabase free-tier pause)

Web app (existing Vite/React app)
   ├─ ProjectListPage.tsx → ProfileMenu → new "API Tokens" MenuItem
   ├─ ApiTokensDialog.tsx (new, clone of LabelsDialog.tsx pattern)
   └─ useApiTokens.ts (new, clone of useLabels.ts pattern)
        → talks to mcp_tokens table via existing anon-key `supabase` client (RLS: auth.uid() = user_id)
```

Token lifecycle: user opens "API Tokens" dialog → clicks "Create" → client generates `kbn_` + 32 random bytes hex → client computes SHA-256 hash of the token → client inserts `{ name, token_hash }` row (never the raw token) → raw token is shown ONCE in the dialog with a copy button → user pastes it into their MCP client config (e.g. `claude mcp add`). Server-side, `mcp-server/src/auth.ts` re-computes SHA-256 of the incoming bearer token and looks it up by `token_hash`.

## Tech Stack

- **Web app** (unchanged): Vite 8, React 18.3.1, TanStack Query 5.102.8, Supabase-js 2.115.0, sonner, lucide-react, Tailwind v4.3.3, `@base-ui/react` UI components.
- **mcp-server** (new, standalone Node package, NOT a pnpm workspace member): `hono`, `@hono/node-server`, `@modelcontextprotocol/sdk` (v1.x stable line, e.g. `^1.29.0`), `@supabase/supabase-js` (`^2.115.0`, same version as root), `zod` (`^3.x`, required by `@modelcontextprotocol/sdk` v1.x for tool input schemas), TypeScript `~5.9.3` (match root).

## Project Conventions

- **Never `git add -A` or `git add .`** — every commit in this plan stages exact file paths.
- Indonesian user-facing strings (toasts, dialog copy) in the web app; English code/comments/identifiers everywhere (including `mcp-server`).
- No automated test framework in this repo — `tsc` (type-check) + `oxlint` (web app only) are the QA gates. `mcp-server` has no lint config; its gate is `tsc` only.
- SQL migrations are plain numbered files in `supabase/migrations/`, immutable once applied to live DB (see comment convention in `20260906020000_project_members_rls.sql`: "JANGAN sunting ... sudah applied ke DB live").
- `src/types/database.types.ts` is hand-maintained (not generated) — every migration that changes the schema must have a matching manual update to this file, plus an addition to its top-of-file running changelog comment.
- CHANGELOG.md entries: reverse-chronological, format `## [Fase N] - YYYY-MM-DD` with `### Added` / `### Notes` / `### Status` subsections, Indonesian prose with backtick code refs.

## Reuse Map

| Need | Reuse | Source |
|---|---|---|
| Dialog shell | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` | `@/components/ui/dialog` |
| Revoke confirmation | `ConfirmDialog` | `@/components/ui/confirm-dialog` |
| Buttons/inputs/loading/empty states | `Button`, `Input`, `Skeleton`, `EmptyState` | `@/components/ui/*` |
| Menu entry point | `MenuItem` inside existing `ProfileMenu` | `src/features/projects/ProjectListPage.tsx` |
| Web Supabase client | `supabase` (anon key) | `@/lib/supabase` |
| DB types | `Database` | `@/types/database.types` |
| Hook file shape (query key factory, useQuery/useMutation, Indonesian toasts) | `useLabels.ts` pattern | `src/features/board/useLabels.ts` |
| Dialog component shape (list + edit-in-place + create row + ConfirmDialog) | `LabelsDialog.tsx` pattern | `src/features/board/LabelsDialog.tsx` |
| RLS helper function pattern (SECURITY DEFINER, stable, search_path=public) | `is_project_member` | `supabase/migrations/20260906020000_project_members_rls.sql` |
| Migration file shape (table + index + RLS + policy) | `20260908020000_labels.sql` | `supabase/migrations/20260908020000_labels.sql` |
| Supabase RPC call syntax | `supabase.rpc("fn_name", { args })` | `src/features/auth/useAuth.ts` |

Nothing new needs to be built as a shared UI primitive — no `Avatar`/`LabelBadge`-style new component required.

## Pre-Plan Reuse Check (completed)

- ✅ Checked `src/components/ui/` — no select/table/badge/copy-button exists; token-copy uses a plain `Button` + inline `navigator.clipboard.writeText()`, no new component.
- ✅ Checked `src/App.tsx` — no settings/dialog route pattern exists in this codebase; all secondary features (Labels, Members, Import) are Dialogs opened from menus. **Deviation from spec wording**: spec says "`ApiTokensPage.tsx`" — this plan builds `ApiTokensDialog.tsx` instead, opened from `ProfileMenu`, matching established convention. Flagged explicitly here as an intentional interpretation, not scope creep.
- ✅ Checked `docs/superpowers/PROGRESS.md` — does not exist. Checked `docs/superpowers/MEMORY.md` — does not exist either. Task 8 (docs) only touches `CHANGELOG.md`, which does exist.
- ✅ Checked `pnpm-workspace.yaml` — does not exist (single-package repo). `mcp-server/` will be a fully standalone package with its own `package.json` and `pnpm install`, importing `database.types.ts` via a relative TS path (works at compile time regardless of workspace linking).
- ✅ Checked root `pnpm-lock.yaml` — no `zod` dependency anywhere; `mcp-server/package.json` adds it fresh.
- ✅ Checked `.github/workflows/deploy.yml` — only builds/deploys the static web app (`dist/` → VPS via rsync). This plan's CI task only adds a build-check job for `mcp-server` (tsc passes); live process deployment (pm2/systemd, subdomain reverse proxy) is infrastructure work explicitly deferred to the maintainer, mirroring the spec's own "manual smoke-check post-deploy" convention.

---

## Task 0: Database migration + type definitions for `mcp_tokens`

**Goal**: Add the `mcp_tokens` table (with RLS) and the `is_project_member_for_user` RPC function the MCP server needs (since it runs with a fixed service-role user, not `auth.uid()`).

**Files**:
- Create `supabase/migrations/20260908030000_mcp_tokens.sql`
- Edit `src/types/database.types.ts`

**Imports**: none (SQL file, and a plain TS interface edit).

**Reuse-check**: Migration follows the exact shape of `supabase/migrations/20260908020000_labels.sql` (table + index + RLS + policy) and the SECURITY DEFINER function shape of `is_project_member` in `supabase/migrations/20260906020000_project_members_rls.sql`.

### Steps

1. Create `supabase/migrations/20260908030000_mcp_tokens.sql`:

```sql
-- 20260908030000_mcp_tokens.sql
-- MCP Server: tabel token API personal (per-user) + fungsi helper untuk
-- pengecekan keanggotaan project dari konteks service_role (tanpa auth.uid()).

create table public.mcp_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  token_hash    text not null unique,
  name          text not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index mcp_tokens_user_idx on public.mcp_tokens(user_id);

alter table public.mcp_tokens enable row level security;

create policy "users manage own mcp tokens" on public.mcp_tokens
  for all using (auth.uid() = user_id);

-- MCP server menyambung pakai service_role key (tidak punya auth.uid()), jadi
-- is_project_member(p_project) bawaan (yang baca auth.uid() internal) tidak
-- bisa dipakai. Fungsi ini terima user_id eksplisit sebagai parameter.
create or replace function public.is_project_member_for_user(p_user_id uuid, p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from project_members
    where project_id = p_project_id
      and user_id = p_user_id
      and status = 'accepted'
  );
$$;

revoke all on function public.is_project_member_for_user(uuid, uuid) from public;
grant execute on function public.is_project_member_for_user(uuid, uuid) to service_role;
```

2. Run the migration against the live DB:

```bash
pnpm migrate:up
```

Verify with `pnpm migrate:status` — the new migration must show as applied.

3. Edit `src/types/database.types.ts`:
   - Update the top-of-file ponytail comment (line 1) to append: `As of migration 20260908030000_mcp_tokens (MCP Server): adds the mcp_tokens table and the is_project_member_for_user(p_user_id, p_project_id) RLS helper function.`
   - Add to the `Functions` block (after `claim_pending_invites`):
     ```ts
     is_project_member_for_user: { Args: { p_user_id: string; p_project_id: string }; Returns: boolean }
     ```
   - Add a new `mcp_tokens` entry inside `Tables` (after `task_labels`, before the closing braces of `Tables`):
     ```ts
     mcp_tokens: {
       Row: {
         id: string
         user_id: string
         token_hash: string
         name: string
         created_at: string
         last_used_at: string | null
       }
       Insert: {
         id?: string
         user_id: string
         token_hash: string
         name: string
         created_at?: string
         last_used_at?: string | null
       }
       Update: {
         id?: string
         user_id?: string
         token_hash?: string
         name?: string
         created_at?: string
         last_used_at?: string | null
       }
       Relationships: []
     }
     ```

### Verify

```bash
pnpm exec tsc -b --noEmit
```
Must exit 0 (type-check only, no build artifacts needed yet).

### Commit

```bash
git add supabase/migrations/20260908030000_mcp_tokens.sql
git add src/types/database.types.ts
git commit -m "feat(db): add mcp_tokens table + is_project_member_for_user RPC"
```

---

## Task 1: `mcp-server` package scaffold

**Goal**: Create the standalone `mcp-server/` package with its build tooling, before writing any source files.

**Files**:
- Create `mcp-server/package.json`
- Create `mcp-server/tsconfig.json`
- Create `mcp-server/.env.example`
- Create `mcp-server/.gitignore`

**Imports**: none (config files only).

**Reuse-check**: `tsconfig.json` mirrors root `tsconfig.node.json`'s strictness flags (pure-Node, no DOM lib).

### Steps

1. Create `mcp-server/package.json`:

```json
{
  "name": "kanban-mcp-server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "start": "node dist/index.js",
    "dev": "node --watch --experimental-strip-types src/index.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "@modelcontextprotocol/sdk": "^1.29.0",
    "@supabase/supabase-js": "^2.115.0",
    "hono": "^4.6.14",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "typescript": "~5.9.3"
  }
}
```

2. Create `mcp-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "verbatimModuleSyntax": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

3. Create `mcp-server/.env.example`:

```
SUPABASE_URL=https://nbcgglhxqtgewtoeqbnf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
PORT=3100
```

4. Create `mcp-server/.gitignore`:

```
node_modules/
dist/
.env
```

5. Install dependencies:

```bash
pnpm install
```
(run inside `mcp-server/` — `workdir` param, not `cd`)

### Verify

```bash
pnpm exec tsc -b
```
Run inside `mcp-server/`. Expected: exits 0 with no source files yet compiled (empty `src/` is fine at this step — if `tsc -b` errors on empty rootDir, create an empty placeholder `mcp-server/src/index.ts` with just `export {}` temporarily; Task 6 will overwrite it).

### Commit

```bash
git add mcp-server/package.json
git add mcp-server/tsconfig.json
git add mcp-server/.env.example
git add mcp-server/.gitignore
git commit -m "chore(mcp-server): scaffold standalone package"
```

---

## Task 2: `mcp-server/src/db.ts` — Supabase client + membership check

**Goal**: Single shared service-role Supabase client, plus the `assertProjectMember` guard every tool calls first.

**Files**: Create `mcp-server/src/db.ts`

**Imports**: `@supabase/supabase-js`, `../../src/types/database.types.ts` (relative path into the root web app's types file — NOT a package import, since `mcp-server` is not a workspace member).

**Reuse-check**: Mirrors `src/lib/supabase.ts`'s eager-throw-if-missing pattern, but uses `process.env.*` (Node) instead of `import.meta.env.*` (Vite), and the service-role key instead of the anon key.

### Steps

1. Create `mcp-server/src/db.ts`:

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../src/types/database.types.ts"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check mcp-server/.env")
}

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
})

export class ForbiddenError extends Error {
  constructor(message = "Not a member of this project") {
    super(message)
    this.name = "ForbiddenError"
  }
}

/**
 * Every tool handler must call this FIRST, before touching any project-scoped
 * data. The service_role client bypasses RLS entirely, so this app-level
 * check is the ONLY authorization gate for cross-project data leakage.
 */
export async function assertProjectMember(userId: string, projectId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_project_member_for_user", {
    p_user_id: userId,
    p_project_id: projectId,
  })
  if (error) throw error
  if (!data) throw new ForbiddenError()
}
```

### Verify

```bash
pnpm exec tsc -b
```
Run inside `mcp-server/`. Exit 0.

### Commit

```bash
git add mcp-server/src/db.ts
git commit -m "feat(mcp-server): add service-role db client + assertProjectMember"
```

---

## Task 3: `mcp-server/src/auth.ts` — bearer auth + rate limit

**Goal**: Hono middleware verifying the bearer token against `mcp_tokens.token_hash`, attaching `userId` to context, and enforcing an in-memory per-token rate limit.

**Files**: Create `mcp-server/src/auth.ts`

**Imports**: `node:crypto` (for SHA-256), `hono` (`Context`, `Next`, `MiddlewareHandler`), `./db.ts`

**Reuse-check**: No existing auth middleware to reuse (this is a brand-new server). Rate-limit map pattern is standard in-memory, no library needed (spec explicitly rules out Redis).

### Steps

1. Create `mcp-server/src/auth.ts`:

```ts
import { createHash } from "node:crypto"
import type { MiddlewareHandler } from "hono"
import { supabase } from "./db.ts"

const RATE_LIMIT_MAX_REQUESTS = 60
const RATE_LIMIT_WINDOW_MS = 60_000

type RateLimitEntry = { count: number; windowStart: number }
const rateLimitMap = new Map<string, RateLimitEntry>()

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

function isRateLimited(tokenHash: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(tokenHash)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(tokenHash, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX_REQUESTS
}

declare module "hono" {
  interface ContextVariableMap {
    userId: string
  }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or malformed Authorization header" }, 401)
  }

  const rawToken = authHeader.slice("Bearer ".length).trim()
  const tokenHash = hashToken(rawToken)

  if (isRateLimited(tokenHash)) {
    return c.json({ error: "Rate limit exceeded" }, 429)
  }

  const { data: tokenRow, error } = await supabase
    .from("mcp_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error) {
    return c.json({ error: "Internal auth error" }, 500)
  }
  if (!tokenRow) {
    return c.json({ error: "Invalid token" }, 401)
  }

  // Fire-and-forget: don't block the request on this write.
  supabase
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .then(() => {})

  c.set("userId", tokenRow.user_id)
  await next()
}
```

### Verify

```bash
pnpm exec tsc -b
```
Run inside `mcp-server/`. Exit 0.

### Commit

```bash
git add mcp-server/src/auth.ts
git commit -m "feat(mcp-server): add bearer auth + in-memory rate limit middleware"
```

---

## Task 4: `mcp-server/src/tools/project.ts`, `list.ts`, `label.ts` — read-only tools

**Goal**: Implement the three read-only lookup tools.

**Files**:
- Create `mcp-server/src/tools/project.ts`
- Create `mcp-server/src/tools/list.ts`
- Create `mcp-server/src/tools/label.ts`

**Imports**: `zod` (`z`), `@modelcontextprotocol/sdk/server/mcp.js` (`McpServer` type only, for the register function signature), `../db.ts`

**Reuse-check**: Each `register*Tools` function follows the same shape: takes `(server: McpServer, userId: string)`, calls `server.registerTool(...)`.

### Steps

1. Create `mcp-server/src/tools/project.ts`:

```ts
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase } from "../db.ts"

export function registerProjectTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_projects",
    {
      description: "List all kanban projects the current user is a member of.",
      inputSchema: {},
    },
    async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, projects(id, name, description)")
        .eq("user_id", userId)
        .eq("status", "accepted")

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }

      const projects = (data ?? []).map((row) => row.projects)
      return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] }
    }
  )
}
```

2. Create `mcp-server/src/tools/list.ts`:

```ts
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase, assertProjectMember } from "../db.ts"

export function registerListTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_lists",
    {
      description: "List all columns (lists) in a project.",
      inputSchema: { project_id: z.string().uuid() },
    },
    async ({ project_id }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true }
      }

      const { data, error } = await supabase
        .from("lists")
        .select("id, name, position")
        .eq("project_id", project_id)
        .order("position")

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    }
  )
}
```

3. Create `mcp-server/src/tools/label.ts`:

```ts
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase, assertProjectMember } from "../db.ts"

export function registerLabelTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_labels",
    {
      description: "List all labels defined in a project.",
      inputSchema: { project_id: z.string().uuid() },
    },
    async ({ project_id }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true }
      }

      const { data, error } = await supabase
        .from("labels")
        .select("id, name, color")
        .eq("project_id", project_id)
        .order("created_at")

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    }
  )
}
```

### Verify

```bash
pnpm exec tsc -b
```
Run inside `mcp-server/`. Expect an error about `../db.ts` not exporting `assertProjectMember` being unused correctly is fine, but `registerProjectTools` etc. being unused (not yet wired into `index.ts`) will NOT error since they're exported. `tsc -b` must exit 0.

### Commit

```bash
git add mcp-server/src/tools/project.ts
git add mcp-server/src/tools/list.ts
git add mcp-server/src/tools/label.ts
git commit -m "feat(mcp-server): add list_projects, list_lists, list_labels tools"
```

---

## Task 5: `mcp-server/src/tools/task.ts` — task CRUD tools

**Goal**: Implement `list_tasks`, `create_task`, `update_task`, `delete_task`, correctly handling the `task_assignees`/`task_labels` join tables as separate write steps (since `tasks` has no `assignee_id`/`label_ids` columns).

**Files**: Create `mcp-server/src/tools/task.ts`

**Imports**: `zod`, `@modelcontextprotocol/sdk/server/mcp.js`, `../db.ts`

**Reuse-check**: Join-table upsert/delete pattern follows `useToggleTaskLabel` in `src/features/board/useLabels.ts` (delete-then-insert, not upsert, since these are composite-PK join tables with no natural "upsert" semantics for a full replacement).

### Steps

1. Create `mcp-server/src/tools/task.ts`:

```ts
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { supabase, assertProjectMember } from "../db.ts"

async function replaceAssignee(taskId: string, assigneeId: string | null | undefined): Promise<void> {
  if (assigneeId === undefined) return // field not provided, leave untouched
  const { error: delError } = await supabase.from("task_assignees").delete().eq("task_id", taskId)
  if (delError) throw delError
  if (assigneeId === null) return // explicit unassign
  const { error: insError } = await supabase
    .from("task_assignees")
    .insert({ task_id: taskId, user_id: assigneeId })
  if (insError) throw insError
}

async function replaceLabels(taskId: string, labelIds: string[] | undefined): Promise<void> {
  if (labelIds === undefined) return // field not provided, leave untouched
  const { error: delError } = await supabase.from("task_labels").delete().eq("task_id", taskId)
  if (delError) throw delError
  if (labelIds.length === 0) return
  const rows = labelIds.map((labelId) => ({ task_id: taskId, label_id: labelId }))
  const { error: insError } = await supabase.from("task_labels").insert(rows)
  if (insError) throw insError
}

export function registerTaskTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_tasks",
    {
      description: "List tasks in a project, optionally filtered to one list.",
      inputSchema: {
        project_id: z.string().uuid(),
        list_id: z.string().uuid().optional(),
      },
    },
    async ({ project_id, list_id }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true }
      }

      let query = supabase
        .from("tasks")
        .select("id, list_id, title, description_md, due_date, position, archived_at")
        .eq("project_id", project_id)
        .is("archived_at", null)
        .order("position")

      if (list_id) query = query.eq("list_id", list_id)

      const { data, error } = await query
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.registerTool(
    "create_task",
    {
      description: "Create a new task in a list.",
      inputSchema: {
        project_id: z.string().uuid(),
        list_id: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        due_date: z.string().datetime().optional(),
        position: z.number(),
        assignee_id: z.string().uuid().optional(),
        label_ids: z.array(z.string().uuid()).optional(),
      },
    },
    async ({ project_id, list_id, title, description, due_date, position, assignee_id, label_ids }) => {
      try {
        await assertProjectMember(userId, project_id)
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true }
      }

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          project_id,
          list_id,
          title,
          description_md: description ?? null,
          due_date: due_date ?? null,
          position,
          created_by: userId,
        })
        .select("id")
        .single()

      if (error || !task) {
        return { content: [{ type: "text", text: `Error: ${error?.message ?? "insert failed"}` }], isError: true }
      }

      try {
        await replaceAssignee(task.id, assignee_id)
        await replaceLabels(task.id, label_ids)
      } catch (err) {
        return { content: [{ type: "text", text: `Task created but side-effects failed: ${(err as Error).message}` }], isError: true }
      }

      return { content: [{ type: "text", text: JSON.stringify({ id: task.id }, null, 2) }] }
    }
  )

  server.registerTool(
    "update_task",
    {
      description: "Update fields on an existing task. Only provided fields are changed.",
      inputSchema: {
        task_id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        list_id: z.string().uuid().optional(),
        position: z.number().optional(),
        due_date: z.string().datetime().nullable().optional(),
        assignee_id: z.string().uuid().nullable().optional(),
        label_ids: z.array(z.string().uuid()).optional(),
      },
    },
    async ({ task_id, title, description, list_id, position, due_date, assignee_id, label_ids }) => {
      const { data: existingTask, error: fetchError } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", task_id)
        .single()

      if (fetchError || !existingTask) {
        return { content: [{ type: "text", text: `Error: task not found` }], isError: true }
      }

      try {
        await assertProjectMember(userId, existingTask.project_id)
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true }
      }

      const updates: Record<string, unknown> = {}
      if (title !== undefined) updates.title = title
      if (description !== undefined) updates.description_md = description
      if (list_id !== undefined) updates.list_id = list_id
      if (position !== undefined) updates.position = position
      if (due_date !== undefined) updates.due_date = due_date

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("tasks").update(updates).eq("id", task_id)
        if (error) {
          return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
        }
      }

      try {
        await replaceAssignee(task_id, assignee_id)
        await replaceLabels(task_id, label_ids)
      } catch (err) {
        return { content: [{ type: "text", text: `Error updating relations: ${(err as Error).message}` }], isError: true }
      }

      return { content: [{ type: "text", text: JSON.stringify({ id: task_id, updated: true }, null, 2) }] }
    }
  )

  server.registerTool(
    "delete_task",
    {
      description: "Permanently delete a task.",
      inputSchema: { task_id: z.string().uuid() },
    },
    async ({ task_id }) => {
      const { data: existingTask, error: fetchError } = await supabase
        .from("tasks")
        .select("project_id")
        .eq("id", task_id)
        .single()

      if (fetchError || !existingTask) {
        return { content: [{ type: "text", text: `Error: task not found` }], isError: true }
      }

      try {
        await assertProjectMember(userId, existingTask.project_id)
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${(err as Error).message}` }], isError: true }
      }

      const { error } = await supabase.from("tasks").delete().eq("id", task_id)
      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true }
      }
      return { content: [{ type: "text", text: JSON.stringify({ id: task_id, deleted: true }, null, 2) }] }
    }
  )
}
```

### Verify

```bash
pnpm exec tsc -b
```
Run inside `mcp-server/`. Exit 0.

### Commit

```bash
git add mcp-server/src/tools/task.ts
git commit -m "feat(mcp-server): add list_tasks, create_task, update_task, delete_task tools"
```

---

## Task 6: `mcp-server/src/keepalive.ts` + `mcp-server/src/index.ts` — wire everything together

**Goal**: Boot the Hono server, mount auth + rate-limit middleware, connect the MCP transport in stateless mode, register all tools, start the keep-alive interval.

**Files**:
- Create `mcp-server/src/keepalive.ts`
- Create/overwrite `mcp-server/src/index.ts`

**Imports**: `@hono/node-server` (`serve`), `hono` (`Hono`), `@modelcontextprotocol/sdk/server/mcp.js` (`McpServer`), `@modelcontextprotocol/sdk/server/streamableHttp.js` (`StreamableHTTPServerTransport`), `./auth.ts`, `./db.ts`, `./tools/project.ts`, `./tools/list.ts`, `./tools/label.ts`, `./tools/task.ts`

**Reuse-check**: No existing server bootstrap to reuse — this is the first Node HTTP server in the repo.

### Steps

1. Create `mcp-server/src/keepalive.ts`:

```ts
import { supabase } from "./db.ts"

const KEEPALIVE_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

/**
 * Pings the DB periodically so Supabase's free-tier 7-day auto-pause never
 * triggers. Logs only — no alerting needed for this scale.
 */
export function startKeepalive(): void {
  setInterval(() => {
    supabase
      .from("projects")
      .select("id")
      .limit(1)
      .then(({ error }) => {
        if (error) {
          console.error("[keepalive] ping failed:", error.message)
        } else {
          console.log("[keepalive] ping ok:", new Date().toISOString())
        }
      })
  }, KEEPALIVE_INTERVAL_MS)
}
```

2. Create `mcp-server/src/index.ts`:

```ts
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { authMiddleware } from "./auth.ts"
import { registerProjectTools } from "./tools/project.ts"
import { registerListTools } from "./tools/list.ts"
import { registerLabelTools } from "./tools/label.ts"
import { registerTaskTools } from "./tools/task.ts"
import { startKeepalive } from "./keepalive.ts"

const PORT = Number(process.env.PORT ?? 3100)

const app = new Hono()

app.get("/health", (c) => c.json({ status: "ok" }))

app.post("/mcp", authMiddleware, async (c) => {
  const userId = c.get("userId")

  // A fresh McpServer + transport per request is required in stateless mode
  // (sessionIdGenerator: undefined) — each request is independent, matching
  // the spec's "no per-request Supabase sessions" design.
  const server = new McpServer({ name: "kanban-mcp-server", version: "1.0.0" })
  registerProjectTools(server, userId)
  registerListTools(server, userId)
  registerLabelTools(server, userId)
  registerTaskTools(server, userId)

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)

  const body = await c.req.json().catch(() => undefined)
  await transport.handleRequest(c.env.incoming, c.env.outgoing, body)

  return c.newResponse(null) // response already sent via c.env.outgoing above
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`kanban-mcp-server listening on port ${info.port}`)
  startKeepalive()
})
```

3. Delete the temporary placeholder `mcp-server/src/index.ts` content from Task 1 if it still says `export {}` (this step's content fully replaces it).

### Verify

```bash
pnpm exec tsc -b
```
Run inside `mcp-server/`. Exit 0.

Manual smoke test (run locally, requires real `.env` with a valid `SUPABASE_SERVICE_ROLE_KEY` — pending maintainer, not part of automated verify):
```bash
pnpm build
pnpm start
# then, in another terminal:
curl http://localhost:3100/health
```
Expected: `{"status":"ok"}`

### Commit

```bash
git add mcp-server/src/keepalive.ts
git add mcp-server/src/index.ts
git commit -m "feat(mcp-server): wire Hono app, MCP transport, and keepalive"
```

---

## Task 7: Web app — `useApiTokens.ts` hook + `ApiTokensDialog.tsx` + menu wiring

**Goal**: Let users generate and revoke their own API tokens from the existing web app UI.

**Files**:
- Create `src/features/projects/useApiTokens.ts`
- Create `src/features/projects/ApiTokensDialog.tsx`
- Edit `src/features/projects/ProjectListPage.tsx`

**Imports**: `@tanstack/react-query`, `sonner` (`toast`), `@/lib/supabase`, `@/types/database.types`, `@/components/ui/dialog`, `@/components/ui/confirm-dialog`, `@/components/ui/button`, `@/components/ui/input`, `@/components/ui/skeleton`, `@/components/ui/empty-state`, `lucide-react` icons, `node:crypto`-equivalent for browser (use Web Crypto API `crypto.subtle.digest`, since this runs in the browser, NOT Node).

**Reuse-check**: `useApiTokens.ts` mirrors `useLabels.ts`'s query-key-factory + useQuery/useMutation shape. `ApiTokensDialog.tsx` mirrors `LabelsDialog.tsx`'s list/create-row/ConfirmDialog structure, with the addition of a one-time token-reveal state.

### Steps

1. Create `src/features/projects/useApiTokens.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

export type ApiToken = Database["public"]["Tables"]["mcp_tokens"]["Row"]

function apiTokensKey(userId: string) {
  return ["mcp-tokens", userId] as const
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `kbn_${hex}`
}

/**
 * Fetch all API tokens for the current user (hash + secret never returned —
 * the DB row itself never stores the raw token, only its SHA-256 hash).
 */
export function useApiTokens(userId: string) {
  return useQuery({
    queryKey: apiTokensKey(userId),
    queryFn: async (): Promise<ApiToken[]> => {
      const { data, error } = await supabase
        .from("mcp_tokens")
        .select("*")
        .eq("user_id", userId)
        .order("created_at")
      if (error) throw error
      return data as ApiToken[]
    },
  })
}

/**
 * Generates a new raw token client-side, hashes it, stores only the hash.
 * Returns the raw token to the caller so it can be shown once — it is never
 * persisted anywhere after this.
 */
export function useCreateApiToken(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      const rawToken = generateRawToken()
      const tokenHash = await sha256Hex(rawToken)
      const { error } = await supabase
        .from("mcp_tokens")
        .insert({ user_id: userId, name, token_hash: tokenHash })
      if (error) throw error
      return rawToken
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokensKey(userId) })
    },
    onError: () => {
      toast.error("Gagal membuat token.")
    },
  })
}

export function useRevokeApiToken(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mcp_tokens").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokensKey(userId) })
    },
    onError: () => {
      toast.error("Gagal mencabut token.")
    },
  })
}
```

2. Create `src/features/projects/ApiTokensDialog.tsx`:

```tsx
import { useState } from "react"
import { KeyIcon, TrashIcon, CopyIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useApiTokens, useCreateApiToken, useRevokeApiToken, type ApiToken } from "./useApiTokens"

interface ApiTokensDialogProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ApiTokensDialog({ userId, open, onOpenChange }: ApiTokensDialogProps) {
  const { data: tokens, isLoading } = useApiTokens(userId)
  const createToken = useCreateApiToken(userId)
  const revokeToken = useRevokeApiToken(userId)

  const [newName, setNewName] = useState("")
  const [pendingRevoke, setPendingRevoke] = useState<ApiToken | null>(null)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  function handleCreate() {
    if (!newName.trim()) return
    createToken.mutate(newName.trim(), {
      onSuccess: (rawToken) => {
        setRevealedToken(rawToken)
        setNewName("")
      },
    })
  }

  function copyRevealedToken() {
    if (!revealedToken) return
    navigator.clipboard.writeText(revealedToken)
    toast.success("Token disalin.")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setRevealedToken(null) }}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>API Tokens</DialogTitle></DialogHeader>

        {revealedToken ? (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-subtle p-3">
            <p className="text-sm">Salin token ini sekarang — tidak akan ditampilkan lagi.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-black/5 px-2 py-1 text-xs">{revealedToken}</code>
              <Button size="sm" onClick={copyRevealedToken}><CopyIcon size={14} /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRevealedToken(null)}>Selesai</Button>
          </div>
        ) : null}

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {isLoading ? (
            <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>
          ) : (tokens?.length ?? 0) === 0 ? (
            <EmptyState icon={<KeyIcon size={18} strokeWidth={1.5} aria-hidden />} title="Belum ada token" />
          ) : (
            tokens?.map((token) => (
              <div key={token.id} className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{token.name}</p>
                  <p className="text-xs text-fg-muted">
                    Dibuat {new Date(token.created_at).toLocaleDateString("id-ID")}
                    {token.last_used_at ? ` · Terakhir dipakai ${new Date(token.last_used_at).toLocaleDateString("id-ID")}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${token.name}`} onClick={() => setPendingRevoke(token)}>
                  <TrashIcon size={14} />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line-subtle pt-3">
          <Input placeholder="Nama token (mis. Claude Code)" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <Button onClick={handleCreate} disabled={!newName.trim()}>Buat</Button>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={!!pendingRevoke}
        onOpenChange={(v) => { if (!v) setPendingRevoke(null) }}
        title={`Cabut "${pendingRevoke?.name}"?`}
        description="Token ini tidak akan bisa dipakai lagi setelah dicabut."
        confirmLabel="Cabut"
        onConfirm={() => { if (pendingRevoke) revokeToken.mutate(pendingRevoke.id); setPendingRevoke(null) }}
      />
    </Dialog>
  )
}

export { ApiTokensDialog }
```

3. Edit `src/features/projects/ProjectListPage.tsx`:
   - Add import: `import { ApiTokensDialog } from "./ApiTokensDialog"`
   - Inside the component that renders `ProfileMenu` (the component holding the current user's `id`), add state: `const [apiTokensOpen, setApiTokensOpen] = useState(false)`
   - Inside the `ProfileMenu`'s `MenuContent`, add a new `MenuItem` between the theme-toggle item and `MenuSeparator`:
     ```tsx
     <MenuItem onClick={() => setApiTokensOpen(true)}>API Tokens</MenuItem>
     ```
   - After the `ProfileMenu`'s closing JSX (or wherever other dialogs are rendered as siblings in this component), render:
     ```tsx
     <ApiTokensDialog userId={user.id} open={apiTokensOpen} onOpenChange={setApiTokensOpen} />
     ```
     (use the actual variable name holding the current user's id in that scope — check the existing `ProfileMenu` props/closure for the correct identifier, likely `user.id` or a `userId` prop already threaded through).

### Verify

```bash
pnpm exec tsc -b --noEmit
pnpm lint
```
Both must exit 0.

### Commit

```bash
git add src/features/projects/useApiTokens.ts
git add src/features/projects/ApiTokensDialog.tsx
git add src/features/projects/ProjectListPage.tsx
git commit -m "feat(web): add API Tokens dialog for MCP server auth"
```

---

## Task 8: CI build-check + CHANGELOG

**Goal**: Ensure `mcp-server` type-checks in CI, and document the feature.

**Files**:
- Edit `.github/workflows/deploy.yml` (add a build-check job — does NOT touch the existing deploy job)
- Edit `CHANGELOG.md`

**Imports**: none.

**Reuse-check**: New CI job follows the same `pnpm install --frozen-lockfile` step shape as the existing `deploy` job, scoped to `mcp-server/` via `working-directory`.

### Steps

1. Edit `.github/workflows/deploy.yml` — add a new job (do not modify the existing `deploy` job). Read the current file first to match its exact `on:`/`jobs:` indentation, then add:

```yaml
  mcp-server-build-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          cache-dependency-path: mcp-server/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: mcp-server
      - run: pnpm exec tsc -b
        working-directory: mcp-server
```

(Match the existing job's exact action versions/style if they differ from the above — read the file first and adapt, do not blindly overwrite the whole file.)

2. Edit `CHANGELOG.md` — insert a new entry at the top (line 3, before `## [Fase 6.2]`):

```markdown
## [MCP Server] - 2026-09-08
### Added
- Server MCP baru di `mcp-server/` (paket Node standalone, di luar workspace pnpm) — AI agent (Claude Code/OpenCode) bisa baca/tulis data kanban lewat HTTP + bearer token
- Tabel `mcp_tokens` baru + fungsi `is_project_member_for_user()` (RLS helper untuk konteks service_role tanpa `auth.uid()`)
- 7 tools MCP: `list_projects`, `list_lists`, `list_labels`, `list_tasks`, `create_task`, `update_task`, `delete_task`
- Dialog "API Tokens" di menu profil — generate token sekali-lihat (SHA-256 hash disimpan, token mentah tidak pernah persist)
- Keep-alive ping tiap 3 hari untuk cegah auto-pause Supabase free-tier

### Notes
- Dependency baru (hanya di `mcp-server/`, bukan root): `hono`, `@hono/node-server`, `@modelcontextprotocol/sdk`, `zod`
- `mcp-server/` sengaja BUKAN pnpm workspace member — standalone package, import `database.types.ts` lewat relative path
- Deviasi dari spec: `ApiTokensPage.tsx` di spec diimplementasi sebagai `ApiTokensDialog.tsx` (dialog, bukan halaman/route baru) — mengikuti konvensi codebase (Labels/Members/Import semua dialog, bukan route)
- Live deploy proses Node `mcp-server` (pm2/systemd, subdomain reverse-proxy) di luar scope plan ini — CI hanya menjalankan build-check (`tsc`), bukan deploy pipeline baru
- Di luar scope: create/update/delete project/list/label via MCP, rotasi/expiry token, rate limit terdistribusi

### Status
- Kode selesai di `main`, 9 task (Task 0-8). Sisa pending maintainer: setup proses Node di VPS (subdomain + reverse proxy + process manager), isi `SUPABASE_SERVICE_ROLE_KEY` di `.env`, smoke-check manual ke-7 tools, push ke `origin/main`
```

### Verify

No build/lint impact from a `.md` and `.yml`-only change beyond visual correctness — confirm YAML indentation is valid by running:
```bash
pnpm exec tsc -b --noEmit
```
(sanity check the repo as a whole still type-checks after all prior tasks)

### Commit

```bash
git add .github/workflows/deploy.yml
git add CHANGELOG.md
git commit -m "docs(mcp-server): add CI build-check job and CHANGELOG entry"
```

---

## Self-Review

- **Spec coverage**: All 153-line spec sections mapped — data model (Task 0), repo layout (Task 1), auth/rate-limit (Task 3), tool surface all 7 tools (Task 4+5), keep-alive (Task 6), web app additions (Task 7), testing/deploy conventions (Task 8). Non-goals respected: no project/list/label mutation tools, no per-request sessions (stateless transport, fresh McpServer per request), no Redis (in-memory Map), no token expiry UI.
- **Placeholder scan**: No `TODO`, `FIXME`, or `...` left in any code block above — every branch (missing field, error, forbidden, not-found) has concrete pseudocode.
- **Type consistency**: All Supabase table/column names cross-checked against `src/types/database.types.ts` (`description_md` not `description`, `task_assignees`/`task_labels` join tables, `position: number`, `due_date`/`archived_at`/`last_used_at` as nullable ISO strings).
- **Reuse violations**: None found — no dialog/hook/migration pattern was reinvented; Task 7 explicitly clones `LabelsDialog.tsx`/`useLabels.ts` shapes, Task 0 clones `20260908020000_labels.sql`/`is_project_member` shapes.
- **Pseudocode completeness**: Every task's code blocks are runnable TypeScript/SQL, not abstract descriptions — a mid-level executor can copy them near-verbatim, adjusting only the one noted ambiguity in Task 7 Step 3 (exact `user.id` variable name in `ProjectListPage.tsx`, flagged explicitly for the executor to verify against the live file at execution time rather than guessed here).

## Execution Handoff

This plan has 9 tasks (Task 0-8) with clear sequential dependencies (Task 0 must run before 2/4/5/7; Tasks 2-6 build `mcp-server` incrementally; Task 7 is independent of Tasks 1-6 except for Task 0's schema; Task 8 depends on everything).

How would you like to execute this plan?
1. **Subagent-Driven Development (recommended)** — matches the convention used for Fase 6.1/6.2 (each task dispatched to a subagent with review checkpoints between tasks).
2. **Inline Execution** — I execute all 9 tasks directly in this session, task by task, with you able to interrupt at any point.

Which do you prefer?

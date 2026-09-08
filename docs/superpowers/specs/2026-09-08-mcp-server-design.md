# MCP Server Design — AI Agent Support for Claude Code / OpenCode

**Status:** Approved
**Date:** 2026-09-08
**Depends on:** Fase 6.1 (Assignee) + Fase 6.2 (Labels) — reuses `is_project_member()` RLS helper and existing `database.types.ts` schema types.

## 1. Goal

Let AI coding agents (Claude Code, OpenCode) read and write kanban data (projects, lists, tasks, labels) directly from the CLI/IDE via the Model Context Protocol, without opening the web UI. Example: "create a task in the Backlog list for project X", "move task Y to Done", "list all my open tasks".

## 2. Non-Goals

- No create/update/delete for projects, lists, or labels via MCP — those stay read-only lookups (used to resolve names to IDs when creating/updating tasks). Managing structure is a web-UI-only concern.
- No per-request Supabase user sessions — the server uses one shared `service_role` identity plus manual authorization checks, not real per-user Postgres sessions.
- No token expiry/rotation UI — tokens live until manually revoked.
- No Redis or external rate-limit store — in-memory per-token counter only.
- No automated test suite — matches the rest of the project's manual-smoke-check convention.

## 3. Data Model

### `mcp_tokens` table

```sql
create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.mcp_tokens enable row level security;

create policy "users manage own tokens" on public.mcp_tokens
  for all using (auth.uid() = user_id);
```

- Token itself (e.g. `kbn_` + 32 random bytes hex) is generated client-side in the web app, shown to the user exactly once, then only its SHA-256 hash is sent to Supabase for storage. The plaintext token is never persisted server-side — standard personal-access-token UX (same pattern as GitHub PATs).
- `name` — user-supplied label for the token (e.g. "Claude Code laptop") so multiple tokens are distinguishable in the revoke list.
- `last_used_at` — updated fire-and-forget on every successful MCP request, shown in the web UI for visibility into whether a token is still active.
- No expiry column — deliberate, matches the "manual revoke only" decision for a personal non-multi-tenant tool.

## 4. Repo Layout

New folder in the existing `personal-kanban` monorepo (not a separate repo), so it can import `src/types/database.types.ts` directly without publishing a package:

```
mcp-server/
├── src/
│   ├── index.ts        Hono app entry — mounts MCP Streamable HTTP transport, starts keepalive interval
│   ├── auth.ts          Bearer token verify middleware + in-memory per-token rate limiter
│   ├── db.ts            Supabase service_role client + assertProjectMember(userId, projectId) helper
│   ├── keepalive.ts     setInterval ping to prevent Supabase free-tier auto-pause
│   └── tools/
│       ├── task.ts      list_tasks, create_task, update_task, delete_task (full CRUD)
│       ├── project.ts   list_projects (read-only)
│       ├── list.ts      list_lists (read-only)
│       └── label.ts     list_labels (read-only)
├── package.json         own deps: hono, @modelcontextprotocol/sdk, @supabase/supabase-js
└── (deploy config — reuses existing VPS webhook auto-deploy pattern, new subdomain)
```

Web app gets one new feature area: a settings page for generating/naming/revoking tokens (e.g. `src/features/settings/ApiTokensPage.tsx` + `useApiTokens.ts` hook, following the same TanStack Query hook convention as `useLabels.ts`/`useTaskAssignees.ts`).

## 5. Framework Choice

**Hono** + **`@modelcontextprotocol/sdk`** (Streamable HTTP transport).

Reasoning: Hono is a minimal, fast HTTP framework with first-class TypeScript support and no heavyweight dependency tree — appropriate for a small always-on Node process. The official `@modelcontextprotocol/sdk` package provides the Streamable HTTP transport binding needed to expose MCP tools over a remote HTTP endpoint (vs. the SDK's stdio transport, which only works for local subprocess-based MCP servers). This is the standard pairing recommended in MCP SDK examples for remote/hosted servers.

## 6. Hosting & Deployment

- Same VPS as the main kanban app.
- New subdomain, e.g. `mcp.cundus.my.id`.
- Reuses the existing webhook auto-deploy infrastructure — push to `main` triggers redeploy of both apps from the same monorepo.

## 7. Authorization Architecture

### Token verification (`auth.ts`)

Every incoming request must carry `Authorization: Bearer <token>`. Middleware:

1. Hash the incoming token (SHA-256).
2. Look up `mcp_tokens` by `token_hash`. Missing → `401 Unauthorized`.
3. Update `last_used_at` for the matched row (fire-and-forget, don't block the request).
4. Attach `userId` to request context for downstream tool handlers.
5. Check the in-memory rate limiter for this token (~60 requests/min). Exceeded → `429 Too Many Requests`.

### Project membership guard (`db.ts`)

```ts
async function assertProjectMember(userId: string, projectId: string): Promise<void> {
  const { data, error } = await supabase.rpc("is_project_member_for_user", {
    p_user_id: userId,
    p_project_id: projectId,
  })
  if (error || !data) throw new McpError("Not a member of this project")
}
```

- ponytail: `is_project_member(project_id)` (the existing RLS helper) reads `auth.uid()` internally, which is unset in a service-role context. This design needs a **new** Postgres function `is_project_member_for_user(p_user_id, p_project_id)` that takes the user id as an explicit parameter instead of relying on `auth.uid()`, so the MCP server (running as service_role, no real Postgres session) can call it via RPC. Add this in the implementation plan as a new migration — it's a thin wrapper reusing the same membership-lookup logic as the existing helper, not new authorization logic.
- Called at the top of every tool handler in `tools/task.ts`, `tools/project.ts`, `tools/list.ts`, `tools/label.ts` before any data access. Since the server holds `service_role` (which bypasses RLS entirely), this application-level check is the *only* authorization gate — it must run on every single tool call, no exceptions.

## 8. MCP Tool Surface

| Tool | Type | Description |
|---|---|---|
| `list_projects()` | read-only | Projects the authenticated user is a member of |
| `list_lists(project_id)` | read-only | Lists (columns) in a project |
| `list_labels(project_id)` | read-only | Labels defined in a project |
| `list_tasks(project_id, list_id?)` | read-only | Tasks in a project, optionally filtered by list |
| `create_task(project_id, list_id, title, description?, due_date?, assignee_id?, label_ids?)` | write | Create a new task |
| `update_task(task_id, { title?, description?, list_id?, position?, due_date?, assignee_id?, label_ids? })` | write | Single flexible tool for any task edit — title, description, moving between lists, reordering, due date, assignee, labels. Only provided fields are updated. |
| `delete_task(task_id)` | write | Delete a task |

`update_task` intentionally covers everything a drag-and-drop move or the task edit dialog can do, so the AI agent can replicate any board interaction through one tool instead of several narrow ones.

## 9. Keep-Alive Ping

Supabase free-tier projects auto-pause after ~7 days of inactivity. Since `mcp-server` is expected to run continuously on the VPS, it also hosts a lightweight keep-alive:

```ts
// keepalive.ts
setInterval(async () => {
  const { error } = await supabase.from("projects").select("id").limit(1)
  console.log(error ? `keepalive ping failed: ${error.message}` : "keepalive ping ok")
}, 3 * 24 * 60 * 60 * 1000) // every 3 days — well under the 7-day pause threshold
```

- Started once in `index.ts` on boot.
- Fire-and-forget, `SELECT 1`-equivalent query — no new table, no persisted ping history.
- Failures only surface via console log (VPS process logs). ponytail: add alerting (e.g. a Telegram notification) if pings start silently failing; out of scope for the initial implementation.

## 10. Error Handling

- Auth/rate-limit failures (401/429) happen at the HTTP middleware layer, before the MCP protocol layer is reached.
- Tool-level failures (e.g. `assertProjectMember` rejection, Supabase query errors, not-found task) are surfaced as MCP protocol errors (`isError: true` with a message in the tool result), per the MCP SDK's standard error-reporting convention — not raw HTTP error codes, since MCP clients expect errors inside the tool-call response shape.
- Tool input validation uses Zod schemas per tool (the `@modelcontextprotocol/sdk`'s `registerTool` API accepts a Zod-based input schema directly) — no new validation library needed.

## 11. Testing

No automated test framework in this repo (established convention across all prior fases). Verification for this feature:

- `tsc` / build passes for both the web app and `mcp-server` (new dedicated `package.json`/`tsconfig.json` for the server needs its own build check).
- Manual smoke-check post-deploy: connect a real Claude Code or OpenCode session to the deployed MCP endpoint, exercise each tool once (list projects, list tasks, create a task, update it, delete it), confirm results reflect correctly in the web UI. Flagged pending-maintainer, same as every prior fase's manual E2E note.

## 12. Out of Scope (Deferred)

- Project/list/label mutation via MCP.
- Token expiry, rotation reminders, or scoped/fine-grained token permissions (e.g. read-only tokens).
- Distributed rate limiting (Redis) — only relevant if this ever needs multi-instance scaling, which a personal tool does not.
- Webhook/push notifications from MCP server back to AI agents (not part of the MCP spec's pull-based tool-call model anyway).

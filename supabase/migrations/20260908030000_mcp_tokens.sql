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

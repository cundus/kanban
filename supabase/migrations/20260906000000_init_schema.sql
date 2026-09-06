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

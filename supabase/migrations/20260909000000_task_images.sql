-- 20260909000000_task_images.sql
-- Prosesing image di task card: tabel metadata + bucket storage privat.
--
-- Gambar disimpan di Supabase Storage (bucket privat `task-images`), diakses
-- lewat signed URL. Baris metadata ada di public.task_images. Path object:
--   <project_id>/<task_id>/<uuid>.<ext>
-- sehingga folder pertama = project_id dan bisa dipakai policy is_project_member.

create table public.task_images (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   integer not null default 0,
  width        integer,
  height       integer,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index task_images_task_idx on public.task_images(task_id);
create index task_images_project_idx on public.task_images(project_id);

alter table public.task_images enable row level security;

create policy "members can view task images" on public.task_images
  for select using (public.is_project_member(project_id));

create policy "members can insert task images" on public.task_images
  for insert with check (
    public.is_project_member(project_id) and created_by = auth.uid()
  );

create policy "members can delete task images" on public.task_images
  for delete using (public.is_project_member(project_id));

-- =========================================================================
-- Storage bucket (privat). file_size_limit 5 MB; hanya tipe gambar umum.
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-images',
  'task-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Policy storage.objects — folder[1] dari path adalah project_id.
create policy "task-images members read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "task-images members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy "task-images members delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-images'
    and public.is_project_member(((storage.foldername(name))[1])::uuid)
  );

-- Keep メモと非公開画像ストレージを追加する。
-- Supabase SQL Editor で一度実行する。何度実行しても安全。

create table if not exists ippo.keep_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(text) <= 20000)
);

create table if not exists ippo.keep_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  note_id uuid not null references ippo.keep_notes (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/webp', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists keep_notes_user_created_idx on ippo.keep_notes (user_id, created_at desc);
create index if not exists keep_attachments_note_idx on ippo.keep_attachments (note_id, created_at);

grant all on ippo.keep_notes, ippo.keep_attachments to authenticated, service_role;

alter table ippo.keep_notes enable row level security;
alter table ippo.keep_attachments enable row level security;

drop policy if exists "own keep notes" on ippo.keep_notes;
create policy "own keep notes" on ippo.keep_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own keep attachments" on ippo.keep_attachments;
create policy "own keep attachments" on ippo.keep_attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ippo-keep',
  'ippo-keep',
  false,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ippo keep select own files" on storage.objects;
create policy "ippo keep select own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'ippo-keep' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ippo keep insert own files" on storage.objects;
create policy "ippo keep insert own files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ippo-keep' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ippo keep delete own files" on storage.objects;
create policy "ippo keep delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ippo-keep' and (storage.foldername(name))[1] = auth.uid()::text);

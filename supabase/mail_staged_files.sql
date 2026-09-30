-- Large chat attachments (run once in Supabase SQL Editor).

create table if not exists mail_staged_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_data bytea,
  storage_path text,
  byte_size integer not null,
  created_at timestamptz not null default now()
);

alter table mail_staged_files
  add column if not exists storage_path text;

alter table mail_staged_files
  alter column file_data drop not null;

create index if not exists mail_staged_files_created_idx
  on mail_staged_files (created_at);

alter table mail_staged_files enable row level security;

-- Private bucket for staged uploads (service role bypasses RLS).
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-staging', 'mail-staging', false, 15728640)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;

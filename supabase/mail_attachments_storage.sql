-- Persist large chat documents in Storage (run once in Supabase SQL Editor).

alter table mail_reply_attachments
  add column if not exists storage_path text;

alter table mail_reply_attachments
  alter column file_data drop not null;

-- Private bucket for saved chat/document attachments (service role bypasses RLS).
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-attachments', 'mail-attachments', false, 20971520)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit;

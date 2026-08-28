-- Quote PDFs and other files sent from the CRM inbox / sales flow.
-- Run in Supabase SQL Editor after mail_replies exists.

create table if not exists mail_reply_attachments (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  file_data bytea not null,
  byte_size integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mail_reply_attachments_reply_idx
  on mail_reply_attachments (reply_id);

alter table mail_reply_attachments enable row level security;

-- Odoo-style chatter extras. Run in Supabase SQL Editor.

-- Internal log notes (never emailed)
create table if not exists mail_notes (
  id uuid primary key default gen_random_uuid(),
  thread_email text not null,
  body_text text not null default '',
  body_html text not null default '',
  author_email text,
  author_name text,
  related_sale_id text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists mail_notes_thread_idx
  on mail_notes (thread_email, created_at desc);

alter table mail_notes enable row level security;

-- Thread followers (auto-CC on send)
create table if not exists mail_followers (
  id uuid primary key default gen_random_uuid(),
  thread_email text not null,
  partner_email text not null,
  partner_name text not null default '',
  user_id text,
  created_at timestamptz not null default now(),
  unique (thread_email, partner_email)
);

create index if not exists mail_followers_thread_idx
  on mail_followers (thread_email);

alter table mail_followers enable row level security;

-- Files attached to a thread without sending
create table if not exists mail_thread_files (
  id uuid primary key default gen_random_uuid(),
  thread_email text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  byte_size integer not null default 0,
  storage_path text,
  file_data bytea,
  uploaded_by_email text,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists mail_thread_files_thread_idx
  on mail_thread_files (thread_email, created_at desc);

alter table mail_thread_files enable row level security;

-- Extra columns on outbound replies
alter table mail_replies
  add column if not exists cc_emails text[] not null default '{}';
alter table mail_replies
  add column if not exists body_html text not null default '';
alter table mail_replies
  add column if not exists edited_at timestamptz;

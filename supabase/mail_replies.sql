-- Run once if you already applied an older schema.sql
create table if not exists mail_replies (
  id uuid primary key default gen_random_uuid(),
  to_name text,
  to_email text not null,
  subject text not null default '',
  body_text text not null default '',
  related_mail_id uuid,
  related_inquiry_id text,
  sent_at timestamptz not null default now()
);

create index if not exists mail_replies_sent_idx
  on mail_replies (sent_at desc);

alter table mail_replies enable row level security;

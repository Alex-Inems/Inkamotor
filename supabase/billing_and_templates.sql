-- Extra tables for saved newsletter templates.
-- Run in Supabase → SQL Editor if this project already had schema.sql.

create table if not exists newsletter_templates (
  id text primary key,
  name text not null,
  subject text not null default '',
  preview text not null default '',
  html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table newsletter_templates enable row level security;

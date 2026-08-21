-- Run once in Supabase → SQL Editor if you already applied schema.sql.
-- New installs: this is also included in schema.sql.

create table if not exists crm_users (
  email text primary key,
  name text not null default '',
  picture text,
  password_hash text,
  google boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

alter table crm_users enable row level security;

-- Cache of inbox message translations (EN / FR / ES).
-- Run once in Supabase → SQL Editor if you already applied schema.sql.

create table if not exists mail_translations (
  locale text not null,
  source_hash text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  primary key (locale, source_hash)
);

alter table mail_translations enable row level security;

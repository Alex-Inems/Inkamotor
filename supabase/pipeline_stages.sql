-- Inkamoto CRM pipeline columns (kanban stages).
-- Run in the Supabase SQL editor if you want stages shared across devices.

create table if not exists pipeline_stages (
  id text primary key,
  label text not null default '',
  sort_order integer not null default 0,
  folded boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists pipeline_stages_sort_idx
  on pipeline_stages (sort_order);

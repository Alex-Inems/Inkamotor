create table if not exists newsletter_subscribers (
  email text primary key,
  name text,
  source text not null default 'manual',
  blocked boolean not null default false,
  added_at timestamptz not null default now()
);

alter table newsletter_subscribers enable row level security;

create index if not exists newsletter_subscribers_added_idx
  on newsletter_subscribers (added_at desc);

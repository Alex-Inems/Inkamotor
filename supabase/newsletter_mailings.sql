-- Email Marketing mailings (Odoo-style drafts for Newsletter)
create table if not exists newsletter_mailings (
  id text primary key,
  name text not null,
  subject text not null default '',
  preview text not null default '',
  html text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'in_queue', 'sending', 'sent')),
  recipient_tag text,
  emails jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz,
  responsible text not null default 'Team',
  template_id text,
  odoo_id integer,
  mailing_date timestamptz,
  sent_count integer not null default 0,
  delivered_pct numeric not null default 0,
  open_pct numeric not null default 0,
  click_pct numeric not null default 0,
  reply_pct numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_mailings_status_idx
  on newsletter_mailings (status, updated_at desc);

create unique index if not exists newsletter_mailings_odoo_id_uidx
  on newsletter_mailings (odoo_id)
  where odoo_id is not null;

create index if not exists newsletter_mailings_mailing_date_idx
  on newsletter_mailings (mailing_date desc nulls last);

alter table newsletter_mailings enable row level security;

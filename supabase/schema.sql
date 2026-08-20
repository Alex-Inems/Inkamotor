-- Inkamoto CRM — run once in Supabase → SQL Editor → Run
-- Service role (server) bypasses RLS. No anon policies on purpose.

create extension if not exists pgcrypto;

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('gsc', 'brevo', 'imap', 'meta', 'webhook')),
  status text not null check (status in ('ok', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  row_count integer not null default 0,
  error text
);

create table if not exists mail_messages (
  id uuid primary key default gen_random_uuid(),
  message_id text unique,
  folder text not null default 'INBOX',
  from_name text,
  from_email text not null,
  to_email text,
  subject text not null default '',
  preview text not null default '',
  body_text text,
  received_at timestamptz not null,
  is_read boolean not null default false,
  synced_at timestamptz not null default now()
);

create index if not exists mail_messages_received_idx
  on mail_messages (received_at desc);

-- Outbound replies sent via Brevo from the CRM Inbox
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

create table if not exists site_inquiries (
  id text primary key,
  name text not null,
  email text not null,
  channel text not null,
  subject text not null default '',
  message text not null default '',
  page text not null default '/',
  status text not null check (status in ('new', 'triaged', 'converted', 'closed')),
  created_at timestamptz not null default now(),
  lead_id text,
  owner text not null default 'Team'
);

create index if not exists site_inquiries_created_idx
  on site_inquiries (created_at desc);

create table if not exists leads (
  id text primary key,
  name text not null,
  email text not null,
  phone text not null default '',
  company text not null default '',
  source text not null,
  status text not null,
  value numeric not null default 0,
  currency text not null default 'USD',
  owner text not null default 'Team',
  created_at date not null,
  last_contact date not null,
  notes text not null default ''
);

create index if not exists leads_created_idx on leads (created_at desc);

create table if not exists follow_ups (
  id text primary key,
  title text not null,
  related_to text not null default '',
  related_type text not null check (related_type in ('inquiry', 'lead', 'sale')),
  related_id text not null,
  due_at date not null,
  status text not null check (status in ('open', 'done', 'overdue')),
  owner text not null default 'Team',
  notes text not null default '',
  created_at date not null
);

create index if not exists follow_ups_due_idx on follow_ups (due_at);

create table if not exists sales (
  id text primary key,
  number text not null unique,
  customer text not null,
  email text not null,
  product text not null,
  amount numeric not null default 0,
  currency text not null default 'USD',
  status text not null,
  source text not null,
  inquiry_id text,
  lead_id text,
  created_at date not null,
  closed_at date,
  notes text not null default ''
);

create index if not exists sales_created_idx on sales (created_at desc);

create table if not exists invoices (
  id text primary key,
  number text not null unique,
  client text not null,
  email text not null,
  client_address text,
  status text not null check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issue_date date not null,
  due_date date not null,
  paid_date date,
  currency text not null check (currency in ('USD', 'EUR')),
  lines jsonb not null default '[]',
  notes text not null default '',
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_issue_idx on invoices (issue_date desc);

create table if not exists newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  brevo_id text unique,
  name text not null,
  subject text not null,
  status text not null,
  audience text,
  recipients integer not null default 0,
  opens integer not null default 0,
  clicks integer not null default 0,
  unsubscribes integer not null default 0,
  preview text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  synced_at timestamptz not null default now()
);

alter table sync_runs enable row level security;
alter table mail_messages enable row level security;
alter table mail_replies enable row level security;
alter table site_inquiries enable row level security;
alter table leads enable row level security;
alter table follow_ups enable row level security;
alter table sales enable row level security;
alter table invoices enable row level security;
alter table newsletter_campaigns enable row level security;

create table if not exists mail_translations (
  locale text not null,
  source_hash text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  primary key (locale, source_hash)
);

alter table mail_translations enable row level security;

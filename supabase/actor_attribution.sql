-- Who sent / created CRM records (run once in Supabase → SQL Editor).
-- Optional: app fills existing owner / salesperson / responsible without this,
-- and falls back gracefully if these columns are missing.

alter table mail_replies
  add column if not exists sent_by_email text,
  add column if not exists sent_by_name text;

alter table sales
  add column if not exists created_by_email text,
  add column if not exists created_by_name text;

alter table leads
  add column if not exists created_by_email text,
  add column if not exists created_by_name text;

alter table follow_ups
  add column if not exists created_by_email text,
  add column if not exists created_by_name text;

alter table invoices
  add column if not exists created_by_email text,
  add column if not exists created_by_name text;

alter table newsletter_mailings
  add column if not exists created_by_email text,
  add column if not exists created_by_name text;

create index if not exists mail_replies_sent_by_email_idx
  on mail_replies (sent_by_email)
  where sent_by_email is not null;

create index if not exists sales_created_by_email_idx
  on sales (created_by_email)
  where created_by_email is not null;

-- Quote / order fields + invoice link (run once in Supabase SQL Editor).

alter table sales add column if not exists lines jsonb not null default '[]';
alter table sales add column if not exists quote_template_name text not null default '';
alter table sales add column if not exists payment_terms text not null default '';
alter table sales add column if not exists validity_date date;
alter table sales add column if not exists terms_html text not null default '';
alter table sales add column if not exists salesperson text not null default '';
alter table sales add column if not exists invoice_id text;

alter table invoices add column if not exists sale_id text;

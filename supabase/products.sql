-- Odoo products catalog (run once in Supabase → SQL Editor if CRM predates this table).
-- New installs: included in schema.sql.

create table if not exists products (
  id text primary key,
  odoo_id integer not null unique,
  name text not null,
  reference text not null default '',
  category text not null default '',
  type text not null check (type in ('service', 'consu', 'product')),
  sale_ok boolean not null default true,
  active boolean not null default true,
  list_price numeric not null default 0,
  currency text not null default 'EUR' check (currency in ('USD', 'EUR')),
  qty_on_hand numeric not null default 0,
  variant_count integer not null default 1,
  description text not null default ''
);

create index if not exists products_name_idx on products (name);

alter table products enable row level security;

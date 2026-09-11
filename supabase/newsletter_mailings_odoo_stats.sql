-- Odoo mailing stats + stable Odoo id (run after newsletter_mailings.sql)
alter table newsletter_mailings
  add column if not exists odoo_id integer,
  add column if not exists mailing_date timestamptz,
  add column if not exists sent_count integer not null default 0,
  add column if not exists delivered_pct numeric not null default 0,
  add column if not exists open_pct numeric not null default 0,
  add column if not exists click_pct numeric not null default 0,
  add column if not exists reply_pct numeric not null default 0;

create unique index if not exists newsletter_mailings_odoo_id_uidx
  on newsletter_mailings (odoo_id)
  where odoo_id is not null;

create index if not exists newsletter_mailings_mailing_date_idx
  on newsletter_mailings (mailing_date desc nulls last);

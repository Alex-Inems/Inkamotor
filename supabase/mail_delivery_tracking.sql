-- Outbound email delivery / open tracking (Brevo transactional)
-- Run in Supabase → SQL Editor.

alter table mail_messages
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text
    check (
      delivery_status is null
      or delivery_status in (
        'queued',
        'sent',
        'delivered',
        'opened',
        'bounced',
        'error'
      )
    ),
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz;

create unique index if not exists mail_messages_provider_message_id_uidx
  on mail_messages (provider_message_id)
  where provider_message_id is not null;

alter table mail_replies
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text
    check (
      delivery_status is null
      or delivery_status in (
        'queued',
        'sent',
        'delivered',
        'opened',
        'bounced',
        'error'
      )
    ),
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz;

create unique index if not exists mail_replies_provider_message_id_uidx
  on mail_replies (provider_message_id)
  where provider_message_id is not null;

# Inkamoto CRM

Internal CRM for [inkamototours.com](https://www.inkamototours.com) — inbox, contacts, leads, sales, invoices, email marketing, and follow-ups.

Deploy on a subdomain (e.g. `crm.inkamototours.com`). Staff log in and work from the app; clients see **Inkamoto Tours** on emails. The personal name of who acted (e.g. Jorge) is stored from the logged-in session for the team.

## Features

| Area | What it does |
|------|----------------|
| **Inbox** | Incoming mail (auto-refresh) + outbound replies with Sent → Delivered → Opened tracking |
| **Contacts** | Contact records with an embedded chat thread (same send path as Inbox) |
| **Leads / Sales / Follow-ups** | Pipeline, quotations, and tasks in Supabase |
| **Invoices** | Create PDF invoices and email them |
| **Email marketing** | Draft / send mailings to subscribers |
| **Odoo sync** | Optional cron pull of contacts, sales, and recent messages (**once daily**, evening UTC) |
| **Setup** | Admin checklist for env / integrations |
| Analytics / Search Console / Meta Ads | Optional / paused as needed |

## Login

Staff can sign in with:

1. **Email + password** — defaults in `lib/auth-credentials.ts` (override with env).
2. **Google** — any Google account can sign in when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set (no invite-only allowlist). Successful Google logins are recorded in `crm_users` when that table exists.

Default password login:

- **Email:** `contact@inkamototours.com`
- **Password:** `InkamotoCRM2026!`

Optional overrides: `CRM_ACCESS_EMAIL`, `CRM_ACCESS_PASSWORD`, `CRM_SESSION_SECRET`.

### Who did what

Outbound mail, sales, leads, follow-ups, invoices, and mailings stamp the logged-in user from the session (`salesperson` / `owner` / `responsible`, plus optional `sent_by_*` / `created_by_*` columns).

- **Clients** always see the brand **Inkamoto Tours** (From name / signatures).
- **Team** sees who sent or owns the record (e.g. seller **Jorge** from the session first name).

## Quick start (local)

```bash
npm install
cp .env.example .env.local
# fill .env.local (see below)
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

## Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste and run `supabase/schema.sql` once.
3. For existing projects, also run any missing incremental scripts as needed:

| Script | Purpose |
|--------|---------|
| `supabase/mail_replies.sql` | Sent replies history |
| `supabase/mail_delivery_tracking.sql` | Delivery / open columns |
| `supabase/mail_attachments.sql` | Reply attachments |
| `supabase/sales_quote.sql` | Quotation fields on sales |
| `supabase/newsletter_mailings.sql` | Email marketing drafts |
| `supabase/crm_users.sql` | Login directory (password + Google) |
| `supabase/actor_attribution.sql` | `sent_by_*` / `created_by_*` for multi-user attribution |
| `supabase/billing_and_templates.sql` | Saved newsletter templates |

New installs that run a current `schema.sql` already include core mail reply + delivery fields; run the extras if a feature is missing.

## Environment variables

Copy from `.env.example`. Never commit `.env.local`.

### Required

| Key | Purpose |
|-----|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role (never in the browser) |

### Email (recommended for live Inbox / contacts chat / invoices / newsletter)

| Key | Purpose |
|-----|---------|
| `BREVO_API_KEY` | Outbound email (replies, quotes, invoices, newsletters) |
| `BREVO_SENDER_EMAIL` | Verified sender, e.g. `contact@inkamototours.com` |
| `BREVO_SENDER_NAME` | Display name — keep as **Inkamoto Tours** for clients |
| `BREVO_LIST_ID` | Newsletter list ID in Brevo |
| `IMAP_HOST` | Usually `mail.privateemail.com` |
| `IMAP_PORT` | `993` |
| `IMAP_USER` | Mailbox user, e.g. `contact@inkamototours.com` |
| `IMAP_PASSWORD` | Mailbox password |

### Google sign-in (optional)

| Key | Purpose |
|-----|---------|
| `GOOGLE_CLIENT_ID` | OAuth Web client |
| `GOOGLE_CLIENT_SECRET` | OAuth secret |
| Redirect URIs | `http://localhost:3000/api/auth/google/callback` and your production `https://…/api/auth/google/callback` |

Search Console can reuse the same OAuth client; see `.env.example` for `GOOGLE_REFRESH_TOKEN` / `GSC_SITE_URL`.

### Odoo sync (optional)

| Key | Purpose |
|-----|---------|
| `ODOO_URL` | e.g. `https://inkamoto-tours.odoo.com` |
| `ODOO_DB` | Database name |
| `ODOO_LOGIN` | Odoo login email |
| `ODOO_PASSWORD` | Odoo password |
| `CRON_SECRET` | Bearer secret for `/api/cron/odoo-sync` |

Vercel Cron is configured in `vercel.json` as `0 19 * * *` (once daily at **19:00 UTC** — about 20:00–21:00 in Brussels).

### Optional

| Key | Purpose |
|-----|---------|
| `NEWSLETTER_AUTO_SUBSCRIBE` | Set `false` to stop auto-adding senders to the list |
| `CRM_DEFAULT_OWNER` | Default owner label when no session name applies |
| `NEXT_PUBLIC_CRM_COGS_RATE` | Optional COGS fraction for P&L (0–1) |
| `BREVO_WEBHOOK_SECRET` | Only if Brevo webhook auth is enabled |

After changing env: restart `npm run dev` or redeploy on Vercel.

Check status in the app at **/setup** (after login).

## Deploy (Vercel)

1. Import the GitHub repo.
2. Add the same env vars for **Production**.
3. Deploy.
4. Point DNS (e.g. `crm.inkamototours.com`) at the Vercel project.
5. For Odoo cron: set `CRON_SECRET` + Odoo vars; confirm the cron job on the Vercel project.

## How to test mail

1. **/setup** — Incoming mailbox + Email sending should be Ready.
2. **Inbox** — Send a test email to `contact@inkamototours.com`, wait ~1 minute (or click **Refresh**).
3. Open the message → reply → confirm it appears in the thread with delivery status.
4. **Contacts** — open a contact with a real email → send from the side chat (same Brevo path).
5. **Invoices** / **Sales** — email a quotation or invoice to yourself.
6. **Email marketing** — send a campaign (add yourself to the Brevo list first).

If send fails, the compose box keeps your draft and shows an error toast (it should not clear as if it succeeded).

### Delivery / open tracking

1. Ensure delivery columns exist (`schema.sql` or `supabase/mail_delivery_tracking.sql`).
2. Prefer a Brevo transactional webhook:  
   `https://<your-crm-host>/api/webhooks/brevo`  
   Events: delivered, opened / unique_opened, hardBounce, softBounce.
3. Without a webhook, the app also polls Brevo events when loading replies (matched by provider message id — not “latest email for this contact”).
4. Chatter shows **Sent → Delivered → Opened** as events arrive for that message.

## Website forms

No webhook or extra setup. Point the Webflow form notification at
`contact@inkamototours.com` — the Inbox sync pulls it in like any other email.

If the notification arrives from a no-reply address, the CRM reads the
visitor's email out of the message body so replies and subscriptions go to the
real person.

## Subscribers

Everyone who emails you is added to the newsletter list automatically
(**Email marketing → Subscribers**). Automated senders (no-reply, mailer-daemon,
postmaster, bounce, support, billing, invoice) are skipped, as is your own
mailbox. Set `NEWSLETTER_AUTO_SUBSCRIBE="false"` to turn this off.

## Security

- CRM pages and APIs (except login / Google OAuth / public webhooks) require a signed session cookie.
- Supabase is used only with the service role on the server.
- Do not commit secrets or expose `SUPABASE_SERVICE_ROLE_KEY` / API keys to the client.
- Google sign-in is open to any Google account by design; lock that down later if you need an invite list.

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm start        # run production build
```

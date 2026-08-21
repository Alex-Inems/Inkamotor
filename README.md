# Inkamoto CRM

Internal CRM for [inkamototours.com](https://www.inkamototours.com) — inbox, leads, sales, invoices, newsletters, and follow-ups.

Deploy on a subdomain (e.g. `crm.inkamototours.com`). Staff log in and work from the app; clients never need to know about Brevo, Namecheap, or Supabase.

## Features

| Area | What it does |
|------|----------------|
| **Inbox** | Incoming mail (auto-refresh every 60s) and your **Replies** — includes website form emails |
| **Leads / Sales / Follow-ups** | Pipeline and tasks stored in Supabase |
| **Invoices** | Create PDF invoices and email them to clients |
| **Newsletter** | Send campaigns to your subscriber list |
| **Setup** | Admin checklist for env / integrations |
| Analytics / Search Console / Meta Ads | **Paused** — not required |

## Login

Default (hardcoded in `lib/auth-credentials.ts`):

- **Email:** `contact@inkamototours.com`
- **Password:** `InkamotoCRM2026!`

Optional overrides in env: `CRM_ACCESS_EMAIL`, `CRM_ACCESS_PASSWORD`, `CRM_SESSION_SECRET`.

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
3. If the project already had an older schema, also run `supabase/mail_replies.sql` (stores sent replies).
4. For saved newsletter templates, run `supabase/billing_and_templates.sql`.

## Environment variables

Copy from `.env.example`. Never commit `.env.local`.

### Required

| Key | Purpose |
|-----|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role (never in the browser) |

### Email (recommended for live Inbox / invoices / newsletter)

| Key | Purpose |
|-----|---------|
| `BREVO_API_KEY` | Outbound email (replies, invoices, newsletters) |
| `BREVO_SENDER_EMAIL` | Verified sender, e.g. `contact@inkamototours.com` |
| `BREVO_SENDER_NAME` | Display name |
| `BREVO_LIST_ID` | Newsletter list ID in Brevo |
| `IMAP_HOST` | Usually `mail.privateemail.com` |
| `IMAP_PORT` | `993` |
| `IMAP_USER` | Mailbox user, e.g. `contact@inkamototours.com` |
| `IMAP_PASSWORD` | Mailbox password |

### Optional

| Key | Purpose |
|-----|---------|
| `NEWSLETTER_AUTO_SUBSCRIBE` | Set `false` to stop auto-adding senders to the list |
| `CRM_DEFAULT_OWNER` | Default owner label |
| `NEXT_PUBLIC_CRM_COGS_RATE` | Optional COGS fraction for P&L (0–1) |

### Paused (not required)

Google Search Console and Meta Ads env keys are commented out in `.env.example`. Re-enable later when ready.

After changing env: restart `npm run dev` or redeploy on Vercel.

Check status in the app at **/setup** (after login).

## Deploy (Vercel)

1. Import the GitHub repo.
2. Add the same env vars for **Production**.
3. Deploy.
4. Point DNS (e.g. `crm.inkamototours.com`) at the Vercel project.

## How to test mail

1. **/setup** — Incoming mailbox + Email sending should be Ready.
2. **Inbox** — Send a test email to `contact@inkamototours.com`, wait ~1 minute (or click **Refresh**).
3. Open the message → **Send reply** → check it under the **Replies** tab.
4. **Invoices** → Email to client (your own address).
5. **Newsletter** → Send a campaign (add yourself to the Brevo list first).

## Website forms

No webhook or extra setup. Point the Webflow form notification at
`contact@inkamototours.com` — the Inbox sync pulls it in like any other email.

If the notification arrives from a no-reply address, the CRM reads the
visitor's email out of the message body so replies and subscriptions go to the
real person.

## Subscribers

Everyone who emails you is added to the newsletter list automatically
(**Newsletter → Subscribers**). Automated senders (no-reply, mailer-daemon,
postmaster, bounce, support, billing, invoice) are skipped, as is your own
mailbox. Set `NEWSLETTER_AUTO_SUBSCRIBE="false"` to turn this off.

## Security

- CRM pages and APIs (except login) require a signed session cookie.
- Supabase is used only with the service role on the server.
- Do not commit secrets or expose `SUPABASE_SERVICE_ROLE_KEY` / API keys to the client.

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm start        # run production build
```

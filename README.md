# Inkamoto CRM

Production CRM for [inkamototours.com](https://www.inkamototours.com) — leads, inbox, invoices, Search Console, newsletter (Brevo), mailbox sync (IMAP).

## What you do

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor (once).
2. Copy `.env.example` → `.env.local` (local) or paste the same keys in **Vercel → Environment Variables**.
3. Fill every required key (see below).
4. Deploy to Vercel (or run `npm run build && npm start`).
5. Open `/login` with `CRM_ACCESS_PASSWORD`.

That is the full setup. No demo seed ships in production — the workspace starts empty and persists in Supabase.

## Required env

| Key | Purpose |
|-----|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key |

Login is hardcoded (see `lib/auth-credentials.ts`):

- Email: `contact@inkamototours.com`
- Password: `InkamotoCRM2026!`

Optional overrides: `CRM_ACCESS_EMAIL`, `CRM_ACCESS_PASSWORD`, `CRM_SESSION_SECRET`.

## Optional integrations

| Keys | Unlocks |
|------|---------|
| Google `GOOGLE_*` + `GSC_SITE_URL` | Search Console + Analytics (organic) |
| `BREVO_*` | Newsletter + email invoices |
| `IMAP_*` | Pull mailbox replies into Inbox |
| `WEBHOOK_SECRET` | `POST /api/webhooks/contact` for Webflow forms |

Check readiness in the app at **/setup** (after login).

## Local

```bash
npm install
cp .env.example .env.local
# fill .env.local
npm run dev
```

## Deploy (Vercel)

1. Import this repo.
2. Add the same env vars for Production.
3. Deploy. Point a subdomain (e.g. `crm.inkamototours.com`) at the project.

## Webflow form → CRM

Send JSON to `/api/webhooks/contact` with header `x-webhook-secret: $WEBHOOK_SECRET`.

Accepted fields: `name` (or `firstName`/`lastName`), `email`, `subject`, `message`, `page`.

## Security notes

- All CRM pages and APIs (except login + webhook) require a signed session cookie.
- Supabase is accessed only with the service role on the server — never expose that key to the browser.
- Meta Ads UI remains placeholder until Marketing API credentials are added later.

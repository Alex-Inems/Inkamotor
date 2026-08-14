"use client";

import { useCallback, useEffect, useState } from "react";
import { btnSecondary } from "@/components/modal";
import { EmptyHint, PageHeader, Panel, StatusBadge } from "@/components/ui";

type IntegrationStatus = {
  ready: boolean;
  paused?: boolean;
  missing: string[];
};

type SetupResponse = {
  status: Record<string, IntegrationStatus>;
  hint: string;
};

const GUIDES: Record<
  string,
  { title: string; where: string; keys: string[]; after?: string }
> = {
  auth: {
    title: "CRM login",
    where: "Hardcoded in lib/auth-credentials.ts",
    keys: ["contact@inkamototours.com", "InkamotoCRM2026!"],
    after: "Optional env overrides: CRM_ACCESS_EMAIL / CRM_ACCESS_PASSWORD.",
  },
  supabase: {
    title: "Supabase (required)",
    where: "supabase.com → New project → Settings → API",
    keys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    after: "Paste supabase/schema.sql in SQL Editor → Run once.",
  },
  // Google / Meta guides commented out — no env required for now.
  // googleSearchConsole: {
  //   title: "Google Search Console (paused)",
  //   where: "console.cloud.google.com → Search Console API → OAuth + refresh token",
  //   keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GSC_SITE_URL"],
  // },
  // metaAds: {
  //   title: "Meta Ads (paused)",
  //   where: "Meta Business Manager → ad account",
  //   keys: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
  // },
  brevo: {
    title: "Brevo (mail + newsletter)",
    where: "brevo.com → Settings → SMTP & API → API keys · verify sender",
    keys: [
      "BREVO_API_KEY",
      "BREVO_SENDER_EMAIL",
      "BREVO_SENDER_NAME",
      "BREVO_LIST_ID",
    ],
    after: "List ID: Contacts → Lists. Needed to send newsletters from CRM.",
  },
  imap: {
    title: "Namecheap mailbox (inbox replies)",
    where: "Private Email → mail.privateemail.com · SSL 993",
    keys: ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD"],
    after: "Use contact@inkamototours.com mailbox password.",
  },
  webhook: {
    title: "Site form webhook (optional)",
    where: "Webflow → form webhook or Make/Zapier → POST /api/webhooks/contact",
    keys: ["WEBHOOK_SECRET"],
    after: "Send header x-webhook-secret with the same value.",
  },
};

export default function SetupPage() {
  const [data, setData] = useState<SetupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/setup");
    const json = await res.json();
    if (!res.ok) {
      setError((json as { error?: string }).error || "Could not load setup");
      setData(null);
      return;
    }
    setError(null);
    setData(json as SetupResponse);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const readyCount = data
    ? Object.values(data.status).filter((s) => s.ready).length
    : 0;
  const total = data ? Object.keys(data.status).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live setup"
        description="Fill .env.local (see .env.example). Restart npm run dev after saving. Same keys on Vercel."
        action={
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          >
            Recheck
          </button>
        }
      />

      {loading && !data ? (
        <EmptyHint>Checking env…</EmptyHint>
      ) : error ? (
        <EmptyHint>{error}</EmptyHint>
      ) : data ? (
        <>
          <p className="text-sm text-mute">
            {readyCount}/{total} integrations ready · {data.hint}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(GUIDES).map(([key, guide]) => {
              const st = data.status[key];
              const ready = st?.ready ?? false;
              const paused = st?.paused ?? !ready;
              return (
                <Panel key={key}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg text-ink">{guide.title}</h2>
                    <StatusBadge
                      tone={ready ? "success" : paused ? "warning" : "warning"}
                    >
                      {ready ? "Ready" : "Paused"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-mute">{guide.where}</p>
                  <ul className="mt-3 space-y-1 font-mono text-xs text-ink">
                    {guide.keys.map((k) => {
                      const miss = st?.missing?.includes(k);
                      return (
                        <li
                          key={k}
                          className={miss ? "text-gold" : "text-mute"}
                        >
                          {miss ? "○ " : "● "}
                          {k}
                        </li>
                      );
                    })}
                  </ul>
                  {guide.after ? (
                    <p className="mt-3 text-xs text-mute">{guide.after}</p>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

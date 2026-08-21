"use client";

import { useCallback, useEffect, useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/modal";
import { EmptyHint, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { useT } from "@/lib/i18n";

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
  {
    titleKey: string;
    whereKey: string;
    keys: string[];
    afterKey?: string;
    connectHref?: string;
    connectKey?: string;
  }
> = {
  auth: {
    titleKey: "pages.setup.authTitle",
    whereKey: "pages.setup.authWhere",
    keys: ["contact@inkamototours.com", "InkamotoCRM2026!"],
    afterKey: "pages.setup.authAfter",
  },
  supabase: {
    titleKey: "pages.setup.supabaseTitle",
    whereKey: "pages.setup.supabaseWhere",
    keys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    afterKey: "pages.setup.supabaseAfter",
  },
  brevo: {
    titleKey: "pages.setup.brevoTitle",
    whereKey: "pages.setup.brevoWhere",
    keys: [
      "BREVO_API_KEY",
      "BREVO_SENDER_EMAIL",
      "BREVO_SENDER_NAME",
      "BREVO_LIST_ID",
    ],
    afterKey: "pages.setup.brevoAfter",
  },
  imap: {
    titleKey: "pages.setup.imapTitle",
    whereKey: "pages.setup.imapWhere",
    keys: ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD"],
    afterKey: "pages.setup.imapAfter",
  },
  googleSearchConsole: {
    titleKey: "pages.setup.googleTitle",
    whereKey: "pages.setup.googleWhere",
    keys: [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_REFRESH_TOKEN",
      "GSC_SITE_URL",
    ],
    afterKey: "pages.setup.googleAfter",
    connectHref: "/api/google/oauth/start",
    connectKey: "pages.setup.googleConnect",
  },
};

export default function SetupPage() {
  const t = useT();
  const [data, setData] = useState<SetupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/setup");
    const json = await res.json();
    if (!res.ok) {
      setError((json as { error?: string }).error || t("pages.setup.loadFailed"));
      setData(null);
      return;
    }
    setError(null);
    setData(json as SetupResponse);
  }, [t]);

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
        title={t("pages.setup.title")}
        description={t("pages.setup.description")}
        action={
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          >
            {t("pages.setup.recheck")}
          </button>
        }
      />

      {loading && !data ? (
        <EmptyHint>{t("pages.setup.checking")}</EmptyHint>
      ) : error ? (
        <EmptyHint>{error}</EmptyHint>
      ) : data ? (
        <>
          <p className="text-sm text-mute">
            {t("pages.setup.readyCount", {
              ready: readyCount,
              total,
              hint: data.hint,
            })}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(GUIDES).map(([key, guide]) => {
              const st = data.status[key];
              const ready = st?.ready ?? false;
              const paused = st?.paused ?? !ready;
              return (
                <Panel key={key}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg text-ink">
                      {t(guide.titleKey)}
                    </h2>
                    <StatusBadge
                      tone={ready ? "success" : paused ? "warning" : "warning"}
                    >
                      {ready ? t("common.ready") : t("common.paused")}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-mute">{t(guide.whereKey)}</p>
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
                  {guide.afterKey ? (
                    <p className="mt-3 text-xs text-mute">{t(guide.afterKey)}</p>
                  ) : null}
                  {guide.connectHref &&
                  guide.connectKey &&
                  !st?.missing?.includes("GOOGLE_CLIENT_ID") &&
                  !st?.missing?.includes("GOOGLE_CLIENT_SECRET") &&
                  !ready ? (
                    <a href={guide.connectHref} className={`${btnPrimary} mt-3 inline-flex`}>
                      {t(guide.connectKey)}
                    </a>
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

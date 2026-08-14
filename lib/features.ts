/** Nav / feature gates driven by env readiness (server). */

import { missingEnv } from "@/lib/api";

export type FeatureId =
  | "supabase"
  | "brevo"
  | "imap"
  | "googleSearchConsole"
  | "metaAds"
  | "webhook";

export type FeatureState = {
  id: FeatureId;
  ready: boolean;
  paused: boolean;
  missing: string[];
  label: string;
};

export function getFeatureStates(): FeatureState[] {
  const googleMissing = missingEnv([
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "GSC_SITE_URL",
  ]);
  const supabaseMissing = missingEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  const brevoMissing = missingEnv([
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
    "BREVO_SENDER_NAME",
    "BREVO_LIST_ID",
  ]);
  const imapMissing = missingEnv([
    "IMAP_HOST",
    "IMAP_PORT",
    "IMAP_USER",
    "IMAP_PASSWORD",
  ]);
  const webhookMissing = missingEnv(["WEBHOOK_SECRET"]);

  // Meta Ads: no env wired yet — always paused for now
  const metaPaused = true;

  return [
    {
      id: "supabase",
      ready: supabaseMissing.length === 0,
      paused: supabaseMissing.length > 0,
      missing: supabaseMissing,
      label: "Supabase",
    },
    {
      id: "brevo",
      ready: brevoMissing.length === 0,
      paused: brevoMissing.length > 0,
      missing: brevoMissing,
      label: "Brevo",
    },
    {
      id: "imap",
      ready: imapMissing.length === 0,
      paused: imapMissing.length > 0,
      missing: imapMissing,
      label: "Namecheap IMAP",
    },
    {
      id: "googleSearchConsole",
      ready: googleMissing.length === 0,
      paused: googleMissing.length > 0,
      missing: googleMissing,
      label: "Google Search Console",
    },
    {
      id: "metaAds",
      ready: false,
      paused: metaPaused,
      missing: [
        "META_APP_ID",
        "META_APP_SECRET",
        "META_ACCESS_TOKEN",
        "META_AD_ACCOUNT_ID",
      ],
      label: "Meta Ads",
    },
    {
      id: "webhook",
      ready: webhookMissing.length === 0,
      paused: webhookMissing.length > 0,
      missing: webhookMissing,
      label: "Webflow webhook",
    },
  ];
}

export function featureMap() {
  return Object.fromEntries(
    getFeatureStates().map((f) => [f.id, f]),
  ) as Record<FeatureId, FeatureState>;
}

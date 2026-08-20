/** Nav / feature gates driven by env readiness (server). */

import { missingEnv } from "@/lib/api";

// Website forms arrive as email in the mailbox, so no webhook feature is needed.
// Google / Meta are paused: "googleSearchConsole" and "metaAds" stay out for now.
export type FeatureId = "supabase" | "brevo" | "imap";

export type FeatureState = {
  id: FeatureId;
  ready: boolean;
  paused: boolean;
  missing: string[];
  label: string;
};

export function getFeatureStates(): FeatureState[] {
  // Google / Meta env checks commented out — not required for now.
  // const googleMissing = missingEnv([
  //   "GOOGLE_CLIENT_ID",
  //   "GOOGLE_CLIENT_SECRET",
  //   "GOOGLE_REFRESH_TOKEN",
  //   "GSC_SITE_URL",
  // ]);
  // const metaMissing = missingEnv([
  //   "META_APP_ID",
  //   "META_APP_SECRET",
  //   "META_ACCESS_TOKEN",
  //   "META_AD_ACCOUNT_ID",
  // ]);

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
      label: "Email sending",
    },
    {
      id: "imap",
      ready: imapMissing.length === 0,
      paused: imapMissing.length > 0,
      missing: imapMissing,
      label: "Incoming mailbox",
    },
    // {
    //   id: "googleSearchConsole",
    //   ready: false,
    //   paused: true,
    //   missing: [],
    //   label: "Google Search Console",
    // },
    // {
    //   id: "metaAds",
    //   ready: false,
    //   paused: true,
    //   missing: [],
    //   label: "Meta Ads",
    // },
  ];
}

export function featureMap() {
  return Object.fromEntries(
    getFeatureStates().map((f) => [f.id, f]),
  ) as Record<FeatureId, FeatureState>;
}

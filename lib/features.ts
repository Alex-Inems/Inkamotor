/** Nav / feature gates driven by env readiness (server). */

import { missingGoogleEnv } from "@/lib/ads/search-console";
import { missingEnv } from "@/lib/api";

// Website forms arrive as email in the mailbox, so no webhook feature is needed.
// Meta Ads stays paused until those keys are added.
export type FeatureId = "supabase" | "brevo" | "imap" | "googleSearchConsole";

export type FeatureState = {
  id: FeatureId;
  ready: boolean;
  paused: boolean;
  missing: string[];
  label: string;
};

export function getFeatureStates(): FeatureState[] {
  const googleMissing = missingGoogleEnv();
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
    {
      id: "googleSearchConsole",
      ready: googleMissing.length === 0,
      paused: googleMissing.length > 0,
      missing: googleMissing,
      label: "Google Search Console",
    },
  ];
}

export function featureMap() {
  return Object.fromEntries(
    getFeatureStates().map((f) => [f.id, f]),
  ) as Record<FeatureId, FeatureState>;
}

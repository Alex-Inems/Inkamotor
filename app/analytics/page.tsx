"use client";

import { PausedFeature } from "@/components/paused-feature";
import { useT } from "@/lib/i18n";

/** Analytics / Google — paused. Live UI kept in analytics-live.tsx (not mounted). */
export default function AnalyticsPage() {
  const t = useT();
  return (
    <PausedFeature
      title={t("pages.analytics.title")}
      description={t("pages.analytics.pausedDescription")}
    />
  );
}

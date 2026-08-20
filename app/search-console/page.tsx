"use client";

import { PausedFeature } from "@/components/paused-feature";
import { useT } from "@/lib/i18n";

/** Search Console — paused. Live UI in search-console-live.tsx (not mounted). */
export default function SearchConsolePage() {
  const t = useT();
  return (
    <PausedFeature
      title={t("pages.searchConsole.title")}
      description={t("pages.searchConsole.pausedDescription")}
    />
  );
}

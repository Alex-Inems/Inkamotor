"use client";

import { PausedFeature } from "@/components/paused-feature";
import { useT } from "@/lib/i18n";

/** Meta Ads — paused. No META_* env required. */
export default function MetaAdsPage() {
  const t = useT();
  return (
    <PausedFeature
      title={t("pages.metaAds.title")}
      description={t("pages.metaAds.pausedDescription")}
    />
  );
}

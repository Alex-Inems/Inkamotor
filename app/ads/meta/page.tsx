"use client";

import { PausedFeature } from "@/components/paused-feature";

/** Meta Ads — paused. No META_* env required. */
export default function MetaAdsPage() {
  return (
    <PausedFeature
      title="Meta Ads"
      description="Meta Ads is paused for now. Use Inbox, Invoices, and Newsletter."
    />
  );
}

// Previous Meta Ads demo UI removed from mount while paused.

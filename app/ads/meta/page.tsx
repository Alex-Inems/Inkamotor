"use client";

import { PausedFeature } from "@/components/paused-feature";

/** Meta Ads — paused. No META_* env required. */
export default function MetaAdsPage() {
  return (
    <PausedFeature
      title="Meta Ads"
      description="Meta Ads is commented out for now — no Meta env required. Use Inbox, Invoices, and Newsletter for Brevo + Namecheap."
    />
  );
}

// Previous Meta Ads demo UI removed from mount while paused.

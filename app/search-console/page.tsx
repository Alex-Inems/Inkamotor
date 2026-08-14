"use client";

import { PausedFeature } from "@/components/paused-feature";

/** Search Console — paused. Live UI in search-console-live.tsx (not mounted). */
export default function SearchConsolePage() {
  return (
    <PausedFeature
      title="Search Console"
      description="Google Search Console is commented out for now — no Google env required."
    />
  );
}

// import SearchConsoleLivePage from "./search-console-live";

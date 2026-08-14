"use client";

import { PausedFeature } from "@/components/paused-feature";

/** Analytics / Google — paused. Live UI kept in analytics-live.tsx (not mounted). */
export default function AnalyticsPage() {
  return (
    <PausedFeature
      title="Analytics"
      description="Google and Meta analytics are commented out for now — no Google or Meta env required."
    />
  );
}

// import { useEffect, useState } from "react";
// import AnalyticsLivePage from "./analytics-live";
// ... feature-gated live page disabled while Google is paused.

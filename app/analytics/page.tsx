"use client";

import { useEffect, useState } from "react";
import { PausedFeature } from "@/components/paused-feature";
import AnalyticsLivePage from "./analytics-live";

export default function AnalyticsPage() {
  const [paused, setPaused] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/features")
      .then((r) => r.json())
      .then(
        (json: {
          features?: { googleSearchConsole?: { paused?: boolean } };
        }) => {
          setPaused(Boolean(json.features?.googleSearchConsole?.paused));
        },
      )
      .catch(() => setPaused(true));
  }, []);

  if (paused === null) {
    return (
      <PausedFeature
        title="Analytics"
        description="Checking integration status…"
      />
    );
  }

  if (paused) {
    return (
      <PausedFeature
        title="Analytics"
        description="Google Search Console analytics are paused until Google env vars are added."
      />
    );
  }

  return <AnalyticsLivePage />;
}

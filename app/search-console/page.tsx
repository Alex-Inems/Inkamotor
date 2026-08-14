"use client";

import { useEffect, useState } from "react";
import { PausedFeature } from "@/components/paused-feature";
import SearchConsoleLivePage from "./search-console-live";

export default function SearchConsolePage() {
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

  if (paused === null || paused) {
    return (
      <PausedFeature
        title="Search Console"
        description="Google Search Console is paused until Google env vars are added."
      />
    );
  }

  return <SearchConsoleLivePage />;
}

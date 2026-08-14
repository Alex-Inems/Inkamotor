"use client";

import { EmptyHint, PageHeader, StatusBadge } from "@/components/ui";
import Link from "next/link";

export function PausedFeature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mb-4 inline-flex">
        <StatusBadge tone="warning">Paused</StatusBadge>
      </div>
      <EmptyHint>
        This area is paused until its environment variables are configured.
        Focus on Inbox, Invoices, and Newsletter for now.{" "}
        <Link href="/setup" className="text-sand hover:text-gold">
          Open Setup
        </Link>
      </EmptyHint>
    </div>
  );
}

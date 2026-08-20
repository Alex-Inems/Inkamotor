"use client";

import { EmptyHint, PageHeader, StatusBadge } from "@/components/ui";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export function PausedFeature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const t = useT();
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="mb-4 inline-flex">
        <StatusBadge tone="warning">{t("common.paused")}</StatusBadge>
      </div>
      <EmptyHint>
        {t("pages.paused.body")}{" "}
        <Link href="/setup" className="text-sand hover:text-gold">
          {t("pages.paused.openSetup")}
        </Link>
      </EmptyHint>
    </div>
  );
}

"use client";

import { SettingsView } from "@/components/settings/settings-view";
import { PageHeader } from "@/components/ui";
import { useLocale } from "@/lib/i18n";
import { settingsMsg } from "@/lib/settings/messages";

export default function SettingsPage() {
  const { locale } = useLocale();
  const title = settingsMsg(locale, "ui.title");

  return (
    <div>
      <PageHeader title={title} />
      <SettingsView />
    </div>
  );
}

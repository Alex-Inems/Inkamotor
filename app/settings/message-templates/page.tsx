"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { btnGhost, btnSecondary } from "@/components/modal";
import { PageHeader, Panel } from "@/components/ui";
import { useCrm } from "@/lib/crm-store";
import { useLocale } from "@/lib/i18n";
import {
  deleteCustomMessageTemplate,
  listCustomMessageTemplates,
  MESSAGE_TEMPLATES,
  type MessageTemplate,
} from "@/lib/mail/message-templates";

export default function MessageTemplatesPage() {
  const { t } = useLocale();
  const { pushToast } = useCrm();
  const [tick, setTick] = useState(0);

  const custom = useMemo(() => {
    void tick;
    return listCustomMessageTemplates();
  }, [tick]);

  const builtIn = useMemo(
    () =>
      [...MESSAGE_TEMPLATES].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [],
  );

  function removeCustom(tpl: MessageTemplate) {
    if (!window.confirm(`${t("pages.inbox.deleteTemplate")}: ${tpl.name}?`)) {
      return;
    }
    if (deleteCustomMessageTemplate(tpl.id)) {
      setTick((n) => n + 1);
      pushToast({ message: t("pages.inbox.templateDeleted"), tone: "success" });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("pages.inbox.manageTemplates")}
        action={
          <Link href="/settings" className={btnSecondary}>
            {t("common.back")}
          </Link>
        }
      />

      <p className="text-sm text-mute">{t("pages.inbox.templatesManageHint")}</p>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mute">
          {t("pages.inbox.templatesCustom")}
          <span className="ml-2 font-normal normal-case tracking-normal text-mute/80">
            ({custom.length})
          </span>
        </h2>
        {custom.length === 0 ? (
          <p className="text-sm text-mute">{t("pages.inbox.noTemplates")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {custom.map((tpl) => (
              <li
                key={`c-${tpl.id}`}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{tpl.name}</p>
                  {tpl.subject ? (
                    <p className="truncate text-xs text-mute">{tpl.subject}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${btnGhost} shrink-0 text-pink`}
                  onClick={() => removeCustom(tpl)}
                >
                  {t("pages.inbox.deleteTemplate")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mute">
          {t("pages.inbox.templatesBuiltIn")}
          <span className="ml-2 font-normal normal-case tracking-normal text-mute/80">
            ({builtIn.length})
          </span>
        </h2>
        <ul className="divide-y divide-line">
          {builtIn.map((tpl) => (
            <li key={`s-${tpl.id}`} className="py-2.5">
              <p className="truncate text-sm font-medium text-ink">{tpl.name}</p>
              {tpl.subject ? (
                <p className="truncate text-xs text-mute">{tpl.subject}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

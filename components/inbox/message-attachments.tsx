"use client";

import { useLocale } from "@/lib/i18n";
import type { ReplyAttachment } from "@/lib/mail/rooms";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachments({
  attachments,
  mine,
}: {
  attachments: ReplyAttachment[];
  mine: boolean;
}) {
  const { t } = useLocale();
  if (attachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((file) => {
        const previewUrl = `/api/inbox/attachments/${file.id}`;
        const downloadUrl = `${previewUrl}?download=1`;
        const isPdf = file.mimeType.includes("pdf");

        return (
          <div
            key={file.id}
            className={`overflow-hidden rounded-md border ${
              mine ? "border-chat-out-text/25 bg-black/10" : "border-line bg-panel"
            }`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-xs ${
                mine ? "text-chat-out-text/90" : "text-ink"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{file.fileName}</p>
                <p className={mine ? "text-chat-out-text/65" : "text-mute"}>
                  {formatBytes(file.byteSize)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {isPdf ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {t("pages.inbox.openAttachment")}
                  </a>
                ) : null}
                <a
                  href={downloadUrl}
                  download={file.fileName}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {t("pages.inbox.downloadAttachment")}
                </a>
              </div>
            </div>
            {isPdf ? (
              <iframe
                title={file.fileName}
                src={previewUrl}
                className="h-56 w-full border-0 bg-white sm:h-72"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

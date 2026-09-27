"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import type { ReplyAttachment } from "@/lib/mail/rooms";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isImageFile(file: ReplyAttachment) {
  if (file.mimeType.startsWith("image/")) return true;
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff"].includes(
    extOf(file.fileName),
  );
}

function isPdfFile(file: ReplyAttachment) {
  return (
    file.mimeType.includes("pdf") || extOf(file.fileName) === "pdf"
  );
}

function isTextFile(file: ReplyAttachment) {
  if (
    file.mimeType.startsWith("text/") ||
    file.mimeType === "application/json" ||
    file.mimeType === "application/xml"
  ) {
    return true;
  }
  return ["txt", "csv", "md", "log", "json", "xml", "html", "htm"].includes(
    extOf(file.fileName),
  );
}

function isOfficeDoc(file: ReplyAttachment) {
  const mime = file.mimeType.toLowerCase();
  if (
    mime.includes("word") ||
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("opendocument") ||
    mime.includes("rtf")
  ) {
    return true;
  }
  return ["doc", "docx", "odt", "rtf", "xls", "xlsx", "ppt", "pptx"].includes(
    extOf(file.fileName),
  );
}

/** Skip Outlook wrapper parts that look like empty "attachment" chips. */
function isJunkAttachment(file: ReplyAttachment) {
  const name = file.fileName.trim().toLowerCase();
  const mime = file.mimeType.toLowerCase();
  if (mime === "message/rfc822" || mime === "application/pkcs7-signature") {
    return true;
  }
  if (mime === "multipart/appledouble") return true;
  if (
    (name === "attachment" || name === "untitled" || name === "noname") &&
    (file.byteSize < 512 || mime.startsWith("text/") || mime === "application/octet-stream")
  ) {
    return true;
  }
  if (file.byteSize > 0 && file.byteSize < 16 && mime.startsWith("text/")) {
    return true;
  }
  return false;
}

function PdfCanvasPreview({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
}) {
  const { t } = useLocale();
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = "";
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        if (data.length < 5 || String.fromCharCode(...data.slice(0, 4)) !== "%PDF") {
          throw new Error("Not a PDF");
        }

        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        const maxPages = Math.min(doc.numPages, 3);
        setPageCount(doc.numPages);

        for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
          const page = await doc.getPage(pageNo);
          const baseViewport = page.getViewport({ scale: 1 });
          const width = Math.min(host.clientWidth || 360, 480);
          const scale = Math.min(1.25, width / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mb-1.5 w-full bg-white";
          canvas.setAttribute("aria-label", `${fileName} · page ${pageNo}`);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) break;
        }

        await doc.destroy();
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      host.innerHTML = "";
    };
  }, [url, fileName]);

  return (
    <div className="border-t border-line/60 bg-[#f4f1ea]">
      {loading ? (
        <p className="px-3 py-4 text-center text-xs text-mute">
          {t("common.loading")}
        </p>
      ) : null}
      {error ? (
        <p className="px-3 py-3 text-center text-xs text-pink">{error}</p>
      ) : null}
      <div ref={hostRef} className="max-h-[20rem] overflow-y-auto p-2" />
      {pageCount > 3 ? (
        <p className="px-3 pb-2 text-center text-[11px] text-mute">
          {pageCount} pages · showing first 3
        </p>
      ) : null}
    </div>
  );
}

function TextFilePreview({ url, fileName }: { url: string; fileName: string }) {
  const { t } = useLocale();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        if (!cancelled) setText(raw.slice(0, 8000));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Preview failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <p className="border-t border-line/60 px-3 py-3 text-center text-xs text-pink">
        {error}
      </p>
    );
  }
  if (text == null) {
    return (
      <p className="border-t border-line/60 px-3 py-3 text-center text-xs text-mute">
        {t("common.loading")}
      </p>
    );
  }
  return (
    <pre className="max-h-48 overflow-auto border-t border-line/60 bg-ash/40 px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap wrap-break-word text-ink">
      {text}
      {text.length >= 8000 ? `\n… (${fileName})` : ""}
    </pre>
  );
}

export function MessageAttachments({
  attachments,
  mine,
  tone = "dark",
}: {
  attachments: ReplyAttachment[];
  mine: boolean;
  tone?: "dark" | "light";
}) {
  const { t } = useLocale();
  const visible = attachments.filter((file) => !isJunkAttachment(file));
  if (visible.length === 0) return null;
  const light = tone === "light";

  return (
    <div className="mt-2 space-y-2">
      {visible.map((file) => {
        const previewUrl = `/api/inbox/attachments/${file.id}`;
        const downloadUrl = `${previewUrl}?download=1`;
        const pdf = isPdfFile(file);
        const image = isImageFile(file);
        const text = isTextFile(file);
        const office = isOfficeDoc(file);

        return (
          <div
            key={file.id}
            className={`overflow-hidden rounded-md border ${
              light
                ? "border-black/10 bg-white/70"
                : mine
                  ? "border-chat-out-text/25 bg-black/10"
                  : "border-line bg-panel"
            }`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-xs ${
                light
                  ? "text-[#1c1b19]"
                  : mine
                    ? "text-chat-out-text/90"
                    : "text-ink"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{file.fileName}</p>
                <p className={light ? "text-black/55" : mine ? "text-chat-out-text/65" : "text-mute"}>
                  {formatBytes(file.byteSize)}
                  {office && !pdf ? " · document" : null}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-semibold underline-offset-2 hover:underline ${light ? "text-[#017e84]" : ""}`}
                >
                  {t("pages.inbox.openAttachment")}
                </a>
                <a
                  href={downloadUrl}
                  download={file.fileName}
                  className={`font-semibold underline-offset-2 hover:underline ${light ? "text-[#017e84]" : ""}`}
                >
                  {t("pages.inbox.downloadAttachment")}
                </a>
              </div>
            </div>
            {pdf ? (
              <PdfCanvasPreview url={previewUrl} fileName={file.fileName} />
            ) : image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={file.fileName}
                className="max-h-64 w-full bg-white object-contain"
                loading="lazy"
              />
            ) : text ? (
              <TextFilePreview url={previewUrl} fileName={file.fileName} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

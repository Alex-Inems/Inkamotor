export function wrapCampaignHtml(html: string, fallbackText = "") {
  const inner = html.trim() || `<p>${escapeHtml(fallbackText)}</p>`;
  if (/\{\{\s*unsubscribe\s*\}\}/i.test(inner)) return inner;
  return `${inner}
<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e6e1d8;font-size:12px;color:#8a8478;font-family:Georgia,serif">
  <a href="{{ unsubscribe }}" style="color:#31595d">Unsubscribe</a>
</p>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brevo wants UTC `YYYY-MM-DD HH:mm:ss`. `localValue` is datetime-local. */
export function toBrevoScheduledAt(localValue: string) {
  const d = new Date(localValue);
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid schedule time.");
  if (d.getTime() < Date.now() + 60_000) {
    throw new Error("Schedule at least one minute in the future.");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

/** Newsletter emails per day. Leaves ~50 of Brevo’s 300 for invoices and replies. */
export const DAILY_NEWSLETTER_CAP = 250;

export function waveCount(recipientCount: number) {
  if (recipientCount <= 0) return 0;
  return Math.ceil(recipientCount / DAILY_NEWSLETTER_CAP);
}

export function isMultiDaySend(recipientCount: number) {
  return recipientCount > DAILY_NEWSLETTER_CAP;
}

export function chunkEmails(
  emails: string[],
  size = DAILY_NEWSLETTER_CAP,
): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < emails.length; i += size) {
    chunks.push(emails.slice(i, i + size));
  }
  return chunks;
}

export function waveCampaignName(base: string, index: number, total: number) {
  const name = base.trim() || "Newsletter";
  if (total <= 1) return name;
  return `${name} · ${index}/${total}`;
}

export function addDays(base: Date, days: number) {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function hasScheduledWaves(campaigns: { status: string }[]) {
  return campaigns.some((campaign) => campaign.status === "scheduled");
}

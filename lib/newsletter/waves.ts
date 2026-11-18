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

/** Tags like Barcelonnette2026 / barce2025 go out on the next daily wave. */
export const TOMORROW_PRIORITY_TAG = /barcelonnet|barce/i;

export function isTomorrowPriorityTag(tag: string) {
  return TOMORROW_PRIORITY_TAG.test(tag);
}

/**
 * Wave 1 (today) is filled from everyone else first.
 * Priority addresses start at wave 2 (tomorrow), then the remaining list.
 */
export function orderForTomorrowPriority(
  emails: string[],
  priority: string[],
  size = DAILY_NEWSLETTER_CAP,
) {
  const unique = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    ),
  ];
  const hot = new Set(
    priority.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
  const first = unique.filter((email) => hot.has(email));
  const rest = unique.filter((email) => !hot.has(email));
  const wave1 = rest.slice(0, size);
  const spill = size - wave1.length;
  const todayHot = spill > 0 ? first.slice(0, spill) : [];
  const tomorrowHot = first.slice(todayHot.length);
  return [...wave1, ...todayHot, ...tomorrowHot, ...rest.slice(size)];
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

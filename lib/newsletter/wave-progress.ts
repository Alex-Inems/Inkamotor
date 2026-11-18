import {
  campaignListIds,
  getBrevoCampaign,
  listBrevoCampaigns,
  listBrevoListEmails,
  mapBrevoCampaign,
  setCampaignRecipientEmails,
  type BrevoCampaign,
} from "@/lib/brevo";
import { DAILY_NEWSLETTER_CAP, chunkEmails } from "@/lib/newsletter/waves";

export type WaveRow = {
  id: number;
  index: number;
  total: number;
  name: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  emails: string[];
  tomorrowPriority: boolean;
};

function parseWaveIndex(campaignName: string, mailingName: string) {
  const prefix = mailingName.trim();
  if (!prefix) return null;
  if (campaignName === prefix) return { index: 1, total: 1 };
  if (!campaignName.startsWith(prefix)) return null;
  const rest = campaignName.slice(prefix.length);
  const match = rest.match(/^\s*[·•\-–]\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!match) return null;
  return { index: Number(match[1]), total: Number(match[2]) };
}

function isPending(wave: { status: string; scheduledAt: string | null; sentAt: string | null }) {
  if (wave.sentAt) return false;
  if (wave.status === "sent" || wave.status === "archived") return false;
  if (wave.status === "scheduled" || wave.status === "draft") return true;
  const at = Date.parse(wave.scheduledAt || "");
  return Number.isFinite(at) && at > Date.now() + 60_000;
}

function isFinished(wave: { status: string; scheduledAt: string | null; sentAt: string | null }) {
  return !isPending(wave);
}

async function emailsForCampaign(campaign: BrevoCampaign) {
  const ids = campaignListIds(campaign);
  if (!ids.length) return [];
  const batches = await Promise.all(ids.map((id) => listBrevoListEmails(id)));
  return [...new Set(batches.flat())];
}

export async function loadMailingWaves(mailingName: string): Promise<WaveRow[]> {
  const listed = await listBrevoCampaigns();
  const matched = listed.filter(
    (row) => parseWaveIndex(row.name, mailingName) != null,
  );
  const detailed = await Promise.all(
    matched.map(async (row) => {
      try {
        return await getBrevoCampaign(row.id);
      } catch {
        return row;
      }
    }),
  );

  const waves: WaveRow[] = [];
  for (const campaign of detailed) {
    const parsed = parseWaveIndex(campaign.name, mailingName);
    if (!parsed) continue;
    const mapped = mapBrevoCampaign(campaign);
    const emails = await emailsForCampaign(campaign);
    waves.push({
      id: campaign.id,
      index: parsed.index,
      total: parsed.total,
      name: campaign.name,
      status: mapped.status,
      scheduledAt: mapped.scheduledAt,
      sentAt: mapped.sentAt,
      recipients: emails.length || mapped.recipients || 0,
      emails,
      tomorrowPriority: false,
    });
  }

  return waves.sort((a, b) => a.index - b.index || a.id - b.id);
}

export function summarizeWaves(waves: WaveRow[]) {
  const totalPeople = waves.reduce((sum, wave) => sum + wave.recipients, 0);
  const sentPeople = waves
    .filter((wave) => isFinished(wave))
    .reduce((sum, wave) => sum + wave.recipients, 0);
  const next = waves.find((wave) => isPending(wave)) ?? null;
  const current =
    waves.filter((wave) => isFinished(wave)).length ||
    (waves[0] ? 1 : 0);
  return {
    totalWaves: waves[0]?.total || waves.length,
    currentWave: Math.min(current, waves[0]?.total || waves.length),
    sentPeople,
    totalPeople,
    next,
  };
}

export async function prioritizeTomorrowWave(
  mailingName: string,
  priorityEmails: string[],
) {
  const waves = await loadMailingWaves(mailingName);
  if (waves.length === 0) {
    throw new Error("No scheduled waves found for this mailing.");
  }

  const hot = new Set(
    priorityEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
  const finished = waves.filter((wave) => isFinished(wave));
  const scheduled = waves.filter((wave) => isPending(wave));
  if (scheduled.length === 0) {
    return { waves, moved: 0, tomorrow: 0 };
  }

  const already = new Set(finished.flatMap((wave) => wave.emails));
  const remaining = [
    ...new Set(
      scheduled
        .flatMap((wave) => wave.emails)
        .filter((email) => email && !already.has(email)),
    ),
  ];
  const first = remaining.filter((email) => hot.has(email));
  const rest = remaining.filter((email) => !hot.has(email));
  const ordered = [...first, ...rest];
  const chunks = chunkEmails(ordered, DAILY_NEWSLETTER_CAP);
  let moved = 0;

  for (let i = 0; i < scheduled.length; i++) {
    const wave = scheduled[i]!;
    const nextEmails = chunks[i] ?? [];
    const before = new Set(wave.emails);
    const changed =
      nextEmails.length !== wave.emails.length ||
      nextEmails.some((email) => !before.has(email));
    if (changed && nextEmails.length > 0) {
      await setCampaignRecipientEmails(wave.id, nextEmails);
      moved += 1;
    }
    wave.emails = nextEmails;
    wave.recipients = nextEmails.length;
    wave.tomorrowPriority = i === 0;
  }

  return {
    waves: [...finished, ...scheduled].sort((a, b) => a.index - b.index),
    moved,
    tomorrow: scheduled[0]?.emails.filter((email) => hot.has(email)).length ?? 0,
  };
}

import { addContactToList, missingBrevoEnv, subscriberListId } from "@/lib/brevo";

/** Automated / system senders that should never join the newsletter list. */
const BLOCKED_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
  "notifications",
  "notification",
  "support",
  "billing",
  "invoice",
  "no_reply",
];

function isSubscribable(email: string) {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return false;

  const [local, domain] = clean.split("@");
  if (BLOCKED_LOCAL_PARTS.some((part) => local.includes(part))) return false;
  // Our own mailbox / sending domain shouldn't subscribe to itself
  const ownAddresses = [
    process.env.IMAP_USER?.trim().toLowerCase(),
    process.env.BREVO_SENDER_EMAIL?.trim().toLowerCase(),
  ].filter(Boolean) as string[];
  if (ownAddresses.includes(clean)) return false;
  if (domain === "unknown") return false;

  return true;
}

export function autoSubscribeEnabled() {
  const flag = process.env.NEWSLETTER_AUTO_SUBSCRIBE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return missingBrevoEnv().length === 0 && subscriberListId() !== null;
}

/**
 * Add senders to the subscriber list. Never throws — subscribing is a
 * side effect of mail sync and must not fail the sync itself.
 */
export async function autoSubscribe(
  people: { email: string; name?: string | null }[],
  source: string,
): Promise<{ added: number }> {
  if (!autoSubscribeEnabled()) return { added: 0 };

  const seen = new Map<string, string | null>();
  for (const person of people) {
    const email = person.email?.trim().toLowerCase();
    if (!email || !isSubscribable(email) || seen.has(email)) continue;
    seen.set(email, person.name ?? null);
  }

  let added = 0;
  for (const [email, name] of seen) {
    try {
      await addContactToList({ email, name, source });
      added += 1;
    } catch {
      /* keep going — one bad contact shouldn't stop the rest */
    }
  }
  return { added };
}

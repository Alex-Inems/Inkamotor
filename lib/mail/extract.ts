/**
 * Website form notifications often arrive from a system address (Webflow,
 * no-reply, etc.) with the visitor's details in the body. These helpers find
 * the real person so replies and subscriptions go to them, not the robot.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const SYSTEM_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "bounces",
  "notifications",
  "notification",
];

const SYSTEM_DOMAINS = ["webflow.io", "webflow.com", "sendgrid.net"];

export function isSystemSender(email: string | null | undefined): boolean {
  const clean = email?.trim().toLowerCase();
  if (!clean || !clean.includes("@")) return true;
  const [local, domain] = clean.split("@");
  if (SYSTEM_LOCAL_PARTS.some((part) => local.includes(part))) return true;
  return SYSTEM_DOMAINS.includes(domain);
}

export function isOwnAddress(
  email: string | null | undefined,
  own: (string | null | undefined)[] = [],
): boolean {
  const clean = email?.trim().toLowerCase();
  if (!clean) return false;
  return own.some((a) => a?.trim().toLowerCase() === clean);
}

/** First email in the body that isn't a system or own address. */
export function extractEmailFromBody(
  body: string | null | undefined,
  exclude: (string | null | undefined)[] = [],
): string | null {
  if (!body) return null;
  const skip = new Set(
    exclude
      .filter(Boolean)
      .map((e) => (e as string).trim().toLowerCase()),
  );

  const matches = body.match(EMAIL_RE) ?? [];
  for (const raw of matches) {
    const email = raw.trim().toLowerCase();
    if (skip.has(email) || isSystemSender(email)) continue;
    return email;
  }
  return null;
}

/** Label after a "Name:" style field, used for form notification bodies. */
export function extractNameFromBody(body: string | null | undefined): string | null {
  if (!body) return null;
  const match = body.match(
    /^\s*(?:name|full name|nombre|nom)\s*[:\-]\s*(.+)$/im,
  );
  const value = match?.[1]?.trim();
  if (!value || value.length > 80 || value.includes("@")) return null;
  return value;
}

/**
 * Who to actually reply to / subscribe for a message. Falls back to the
 * envelope sender when the body has nothing better.
 */
export function messageContact(input: {
  fromEmail: string;
  fromName?: string | null;
  bodyText?: string | null;
  ownAddresses?: (string | null | undefined)[];
}): { email: string; name: string | null; fromForm: boolean } {
  const own = input.ownAddresses ?? [];
  if (!isSystemSender(input.fromEmail)) {
    return {
      email: input.fromEmail,
      name: input.fromName ?? null,
      fromForm: false,
    };
  }

  const email = extractEmailFromBody(input.bodyText, [
    input.fromEmail,
    ...own,
  ]);
  if (!email) {
    return {
      email: input.fromEmail,
      name: input.fromName ?? null,
      fromForm: false,
    };
  }

  return {
    email,
    name: extractNameFromBody(input.bodyText) ?? null,
    fromForm: true,
  };
}

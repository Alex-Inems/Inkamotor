import { listMailMessages, type MailMessage } from "@/lib/mail/imap";
import { listMailReplies, type MailReply } from "@/lib/mail/replies";
import { translateTexts, type TranslateStats } from "@/lib/mail/translate";
import { locales, type Locale } from "@/lib/i18n/config";

function mergeStats(parts: TranslateStats[]): TranslateStats {
  return parts.reduce(
    (acc, p) => ({
      unique: acc.unique + p.unique,
      cached: acc.cached + p.cached,
      translated: acc.translated + p.translated,
      failed: acc.failed + p.failed,
    }),
    { unique: 0, cached: 0, translated: 0, failed: 0 },
  );
}

export async function translateMailList(
  messages: MailMessage[],
  locale: Locale,
): Promise<{ messages: MailMessage[]; stats: TranslateStats }> {
  try {
    const blobs = messages.flatMap((m) => [
      m.subject,
      m.preview,
      m.bodyText ?? "",
    ]);
    const { values, stats } = await translateTexts(blobs, locale);
    const next = messages.map((m, i) => {
      const base = i * 3;
      return {
        ...m,
        subject: values[base] || m.subject,
        preview: values[base + 1] || m.preview,
        bodyText: m.bodyText ? values[base + 2] || m.bodyText : m.bodyText,
      };
    });
    return { messages: next, stats };
  } catch {
    return {
      messages,
      stats: { unique: 0, cached: 0, translated: 0, failed: 0 },
    };
  }
}

export async function translateReplyList(
  replies: MailReply[],
  locale: Locale,
): Promise<{ replies: MailReply[]; stats: TranslateStats }> {
  try {
    const blobs = replies.flatMap((r) => [r.subject, r.bodyText]);
    const { values, stats } = await translateTexts(blobs, locale);
    const next = replies.map((r, i) => {
      const base = i * 2;
      return {
        ...r,
        subject: values[base] || r.subject,
        bodyText: values[base + 1] || r.bodyText,
      };
    });
    return { replies: next, stats };
  } catch {
    return {
      replies,
      stats: { unique: 0, cached: 0, translated: 0, failed: 0 },
    };
  }
}

export async function localizedMailMessages(locale: Locale) {
  const messages = await listMailMessages();
  return translateMailList(messages, locale);
}

export async function localizedMailReplies(locale: Locale) {
  const replies = await listMailReplies();
  return translateReplyList(replies, locale);
}

/** Pre-fill the translation cache for every stored message + reply. */
export async function translateAllStoredMail(targets: Locale[] = [...locales]) {
  const messages = await listMailMessages(500);
  const replies = await listMailReplies(500);
  const perLocale: Record<string, TranslateStats> = {};
  for (const locale of targets) {
    const mail = await translateMailList(messages, locale);
    const sent = await translateReplyList(replies, locale);
    perLocale[locale] = mergeStats([mail.stats, sent.stats]);
  }
  return {
    messages: messages.length,
    replies: replies.length,
    locales: targets,
    stats: perLocale,
  };
}

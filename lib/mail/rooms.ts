import {
  cleanBody,
  contactFromFields,
  isBulkMail,
  previewOf,
  type CleanBody,
  type FormField,
} from "@/lib/mail/clean";
import {
  extractEmailFromBody,
  isOwnAddress,
  isSystemSender,
  messageContact,
} from "@/lib/mail/extract";

export type MailItem = {
  id: string;
  fromName: string | null;
  fromEmail: string;
  toEmail: string | null;
  subject: string;
  preview: string;
  bodyText: string | null;
  receivedAt: string;
  isRead: boolean;
};

export type ReplyItem = {
  id: string;
  toName: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  relatedMailId: string | null;
  sentAt: string;
};

export type RoomMessage = {
  key: string;
  mine: boolean;
  at: string;
  subject: string;
  clean: CleanBody;
  raw: string;
  mailId?: string;
};

export type MailRoom = {
  email: string;
  name: string | null;
  messages: RoomMessage[];
  lastAt: string;
  lastText: string;
  unread: number;
  bulk: boolean;
  lastSubject: string;
  lastMailId?: string;
  fields: FormField[];
};

export function displayContactName(name: string | null, email: string) {
  const n = name?.trim();
  if (n) return n;
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._+-]+/g, " ");
}

export function phoneFromFields(fields: FormField[]) {
  return (
    fields.find((f) => /phone|tel|mobile|whatsapp/i.test(f.label))?.value ?? ""
  );
}

/** One conversation per person: forms + real mail, plus your sent replies. */
export function groupMailRooms(input: {
  mail: MailItem[];
  replies: ReplyItem[];
  ownAddresses: (string | null | undefined)[];
  openedEmails?: string[];
}): MailRoom[] {
  const { mail, replies, ownAddresses } = input;
  const opened = input.openedEmails ?? [];
  const byEmail = new Map<string, MailRoom>();

  const ensure = (email: string, name: string | null) => {
    const key = email.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      if (!existing.name && name) existing.name = name;
      return existing;
    }
    const fresh: MailRoom = {
      email: key,
      name,
      messages: [],
      lastAt: "",
      lastText: "",
      unread: 0,
      bulk: false,
      lastSubject: "",
      fields: [],
    };
    byEmail.set(key, fresh);
    return fresh;
  };

  const hasNearDuplicate = (
    room: MailRoom,
    mine: boolean,
    raw: string,
    at: string,
  ) => {
    const preview = previewOf(cleanBody(raw));
    const ts = new Date(at).getTime();
    return room.messages.some((msg) => {
      if (msg.mine !== mine) return false;
      if (previewOf(msg.clean) !== preview) return false;
      return Math.abs(new Date(msg.at).getTime() - ts) < 5 * 60_000;
    });
  };

  for (const m of mail) {
    const raw = m.bodyText || m.preview || "";
    const clean = cleanBody(raw, m.subject);
    const ownOutbound = isOwnAddress(m.fromEmail, ownAddresses);

    if (ownOutbound) {
      const recipient =
        m.toEmail &&
        !isOwnAddress(m.toEmail, ownAddresses) &&
        !isSystemSender(m.toEmail)
          ? m.toEmail
          : extractEmailFromBody(raw, [
              m.fromEmail,
              m.toEmail,
              ...ownAddresses,
            ]);
      if (!recipient || isOwnAddress(recipient, ownAddresses)) continue;
      const room = ensure(recipient, null);
      if (hasNearDuplicate(room, true, raw, m.receivedAt)) continue;
      room.messages.push({
        key: `out-mail-${m.id}`,
        mine: true,
        at: m.receivedAt,
        subject: m.subject,
        clean: cleanBody(raw),
        raw,
      });
      continue;
    }

    const contact = messageContact({
      fromEmail: m.fromEmail,
      fromName: m.fromName,
      bodyText: raw,
      ownAddresses,
    });
    const fromForm = clean.isForm || contact.fromForm;
    const formContact = clean.isForm
      ? contactFromFields(clean.fields)
      : { name: null, email: null };
    const room = ensure(
      formContact.email ?? contact.email,
      formContact.name ?? (fromForm ? contact.name : m.fromName),
    );
    room.messages.push({
      key: `in-${m.id}`,
      mine: false,
      at: m.receivedAt,
      subject: m.subject,
      clean,
      raw,
      mailId: m.id,
    });
    if (clean.fields.length > 0) room.fields = clean.fields;
    if (!m.isRead && !opened.includes(room.email)) room.unread += 1;
    if (isBulkMail({ fromEmail: m.fromEmail, isForm: clean.isForm, raw })) {
      room.bulk = true;
    }
  }

  for (const r of replies) {
    const related = [...byEmail.values()].find((room) =>
      room.messages.some((msg) => msg.mailId === r.relatedMailId),
    );
    const target =
      related?.email ??
      (isSystemSender(r.toEmail) || isOwnAddress(r.toEmail, ownAddresses)
        ? null
        : r.toEmail);
    if (!target) continue;
    const room = ensure(target, r.toName ?? related?.name ?? null);
    if (hasNearDuplicate(room, true, r.bodyText, r.sentAt)) continue;
    room.messages.push({
      key: `out-${r.id}`,
      mine: true,
      at: r.sentAt,
      subject: r.subject,
      clean: cleanBody(r.bodyText),
      raw: r.bodyText,
    });
  }

  const list = [...byEmail.values()];
  for (const room of list) {
    room.messages.sort((a, b) => a.at.localeCompare(b.at));
    const last = room.messages[room.messages.length - 1];
    room.lastAt = last?.at ?? "";
    room.lastText = last
      ? `${last.mine ? "You: " : ""}${previewOf(last.clean, "(no message)")}`
      : "";
    const lastIn = [...room.messages].reverse().find((m) => !m.mine);
    room.lastSubject = lastIn?.subject ?? last?.subject ?? "";
    room.lastMailId = lastIn?.mailId;
  }
  return list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

import type { CrmSnapshot } from "@/lib/crm/types";
import { type Locale } from "@/lib/i18n/config";
import { translateTexts } from "@/lib/mail/translate";

export async function localizeCrmSnapshot(
  data: CrmSnapshot,
  locale: Locale,
): Promise<CrmSnapshot> {
  const texts: string[] = [];
  const push = (value: string) => {
    const i = texts.length;
    texts.push(value ?? "");
    return i;
  };

  const leadNotes = data.leads.map((l) => push(l.notes));
  const inquirySubjects = data.siteInquiries.map((i) => push(i.subject));
  const inquiryMessages = data.siteInquiries.map((i) => push(i.message));
  const followTitles = data.followUps.map((f) => push(f.title));
  const followNotes = data.followUps.map((f) => push(f.notes));
  const saleProducts = data.sales.map((s) => push(s.product));
  const saleNotes = data.sales.map((s) => push(s.notes));

  if (texts.length === 0) return data;

  try {
    const { values } = await translateTexts(texts, locale);
    const at = (i: number, fallback: string) => values[i] || fallback;
    return {
      ...data,
      leads: data.leads.map((lead, i) => ({
        ...lead,
        notes: at(leadNotes[i], lead.notes),
      })),
      siteInquiries: data.siteInquiries.map((row, i) => ({
        ...row,
        subject: at(inquirySubjects[i], row.subject),
        message: at(inquiryMessages[i], row.message),
      })),
      followUps: data.followUps.map((row, i) => ({
        ...row,
        title: at(followTitles[i], row.title),
        notes: at(followNotes[i], row.notes),
      })),
      sales: data.sales.map((row, i) => ({
        ...row,
        product: at(saleProducts[i], row.product),
        notes: at(saleNotes[i], row.notes),
      })),
    };
  } catch {
    return data;
  }
}

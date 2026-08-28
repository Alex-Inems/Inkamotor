import { jsPDF } from "jspdf";
import { invoiceCompany } from "@/lib/invoice-company";
import { type Sale } from "@/lib/demo-data";
import { saleTotal, stripHtml } from "@/lib/sale-quote";
import { resolveSaleTermsHtml } from "@/lib/quote-template-terms";
import { formatDate, formatSalesMoney } from "@/lib/format";
import { messagesFor, type Locale } from "@/lib/i18n";

const brand = {
  teal: [49, 89, 93] as const,
  tealDeep: [36, 66, 70] as const,
  ink: [28, 27, 25] as const,
  mute: [138, 132, 120] as const,
  body: [92, 88, 80] as const,
  gold: [236, 187, 90] as const,
  cream: [244, 229, 193] as const,
  line: [230, 225, 216] as const,
  white: [255, 255, 255] as const,
  stripe: [
    [49, 89, 93],
    [225, 115, 108],
    [98, 78, 138],
    [236, 187, 90],
    [159, 38, 39],
  ] as const,
};

function rgb(doc: jsPDF, c: readonly [number, number, number], mode: "fill" | "text" | "draw") {
  if (mode === "fill") doc.setFillColor(c[0], c[1], c[2]);
  else if (mode === "text") doc.setTextColor(c[0], c[1], c[2]);
  else doc.setDrawColor(c[0], c[1], c[2]);
}

async function logoDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 480;
        canvas.height = img.naturalHeight || 120;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = "/inkamoto-logo.svg";
  });
}

/** Branded quote PDF — same visual language as invoice export. */
export async function renderQuotePdf(sale: Sale, locale: Locale = "fr") {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const copy = messagesFor(locale).quoteDoc;
  const money = (n: number) => formatSalesMoney(n, locale);
  const total = saleTotal(sale) || sale.amount;
  const logo = await logoDataUrl();

  rgb(doc, brand.white, "fill");
  doc.rect(0, 0, pageW, pageH, "F");

  const stripeH = 2.2;
  const bandW = pageW / brand.stripe.length;
  brand.stripe.forEach((c, i) => {
    rgb(doc, c, "fill");
    doc.rect(i * bandW, 0, bandW + 0.2, stripeH, "F");
  });

  const headerTop = stripeH;
  const headerH = 42;
  rgb(doc, brand.teal, "fill");
  doc.rect(0, headerTop, pageW, headerH, "F");
  rgb(doc, brand.tealDeep, "fill");
  doc.rect(0, headerTop + headerH - 1.2, pageW, 1.2, "F");

  let y = headerTop + 10;
  if (logo) doc.addImage(logo, "PNG", margin, y - 4, 42, 11);
  else {
    rgb(doc, brand.white, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(invoiceCompany.name, margin, y + 2);
  }

  rgb(doc, brand.white, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(`${copy.tagline}\n${invoiceCompany.address}`, 95), margin, y + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(copy.quotation.toUpperCase(), pageW - margin, y + 2, { align: "right" });
  rgb(doc, brand.gold, "text");
  doc.setFontSize(12);
  doc.text(sale.number, pageW - margin, y + 11, { align: "right" });

  y = headerTop + headerH + 12;
  rgb(doc, brand.mute, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(copy.number.toUpperCase(), margin, y);
  doc.text(copy.issued.toUpperCase(), margin + 48, y);
  doc.text(copy.validUntil.toUpperCase(), margin + 96, y);
  y += 5;
  rgb(doc, brand.ink, "text");
  doc.setFontSize(10);
  doc.text(sale.number, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(sale.createdAt, locale), margin + 48, y);
  doc.text(sale.validityDate ? formatDate(sale.validityDate, locale) : "—", margin + 96, y);

  y += 10;
  if (sale.quoteTemplateName) {
    rgb(doc, brand.teal, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(sale.quoteTemplateName, margin, y);
    y += 7;
  }

  rgb(doc, brand.mute, "text");
  doc.setFontSize(7);
  doc.text(copy.customer.toUpperCase(), margin, y);
  y += 5;
  rgb(doc, brand.ink, "text");
  doc.setFontSize(10);
  doc.text(sale.customer, margin, y);
  y += 5;
  rgb(doc, brand.body, "text");
  doc.setFontSize(9);
  doc.text(sale.email, margin, y);
  if (sale.paymentTerms) {
    y += 6;
    doc.text(`${copy.paymentTerms}: ${sale.paymentTerms}`, margin, y);
  }

  y += 10;
  rgb(doc, brand.teal, "fill");
  doc.rect(margin, y - 5, contentW, 9, "F");
  rgb(doc, brand.white, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(copy.description.toUpperCase(), margin + 3, y);
  doc.text(copy.qty.toUpperCase(), margin + contentW * 0.58, y, { align: "right" });
  doc.text(copy.unit.toUpperCase(), margin + contentW * 0.76, y, { align: "right" });
  doc.text(copy.amount.toUpperCase(), margin + contentW - 3, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const line of sale.lines) {
    if (y > 250) {
      doc.addPage();
      y = margin + 8;
    }
    if (line.displayType === "section") {
      rgb(doc, brand.teal, "fill");
      doc.setFillColor(247, 244, 239);
      doc.rect(margin, y - 4, contentW, 7, "F");
      rgb(doc, brand.teal, "text");
      doc.setFont("helvetica", "bold");
      doc.text(line.description, margin + 3, y);
      doc.setFont("helvetica", "normal");
      y += 8;
      continue;
    }
    if (line.displayType === "note") {
      rgb(doc, brand.body, "text");
      doc.setFontSize(8);
      const note = doc.splitTextToSize(line.description, contentW - 6);
      doc.text(note, margin + 3, y);
      y += note.length * 3.6 + 4;
      doc.setFontSize(9);
      continue;
    }
    const desc = doc.splitTextToSize(line.description, contentW * 0.5);
    rgb(doc, brand.ink, "text");
    doc.text(desc, margin + 3, y);
    doc.text(String(line.qty), margin + contentW * 0.58, y, { align: "right" });
    doc.text(money(line.unitPrice), margin + contentW * 0.76, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(money(line.qty * line.unitPrice), margin + contentW - 3, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += Math.max(8, desc.length * 4.2);
  }

  y += 4;
  const boxW = 72;
  const boxX = margin + contentW - boxW;
  rgb(doc, brand.cream, "fill");
  doc.rect(boxX, y - 3, boxW, 18, "F");
  rgb(doc, brand.teal, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(copy.total.toUpperCase(), boxX + 5, y + 3);
  doc.setFontSize(16);
  doc.text(money(total), boxX + boxW - 4, y + 11, { align: "right" });
  y += 24;

  const termsHtml = resolveSaleTermsHtml(sale, locale);
  if (termsHtml) {
    rgb(doc, brand.body, "text");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const terms = doc.splitTextToSize(stripHtml(termsHtml), contentW);
    for (const chunk of terms) {
      if (y > pageH - 20) {
        doc.addPage();
        y = margin;
      }
      doc.text(chunk, margin, y);
      y += 3.5;
    }
  }

  rgb(doc, brand.teal, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(copy.thanks, margin, Math.min(y + 6, pageH - 10));

  brand.stripe.forEach((c, i) => {
    rgb(doc, c, "fill");
    doc.rect(i * bandW, pageH - stripeH, bandW + 0.2, stripeH, "F");
  });

  return doc;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function buildQuotePdfBase64(sale: Sale, locale: Locale = "fr") {
  const doc = await renderQuotePdf(sale, locale);
  const buffer = doc.output("arraybuffer") as ArrayBuffer;
  return arrayBufferToBase64(buffer);
}

export async function downloadQuotePdf(sale: Sale, locale: Locale = "fr") {
  const doc = await renderQuotePdf(sale, locale);
  doc.save(`${sale.number}-devis.pdf`);
}

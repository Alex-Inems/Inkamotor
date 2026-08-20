import { jsPDF } from "jspdf";
import { invoiceCompany } from "@/lib/invoice-company";
import { invoiceTotal, type Invoice } from "@/lib/demo-data";
import { formatDate, formatMoney } from "@/lib/format";
import { messagesFor, type Locale } from "@/lib/i18n";

/** Brand tokens matching invoice preview / inkamototours.com */
const brand = {
  teal: [49, 89, 93] as const, // #31595d
  tealDeep: [36, 66, 70] as const, // #244246
  ink: [28, 27, 25] as const, // #1c1b19
  mute: [138, 132, 120] as const,
  body: [92, 88, 80] as const,
  gold: [236, 187, 90] as const, // #ecbb5a
  cream: [244, 229, 193] as const, // #f4e5c1
  pink: [225, 115, 108] as const, // #e1736c
  purple: [98, 78, 138] as const, // #624e8a
  wine: [159, 38, 39] as const, // #9f2627
  line: [230, 225, 216] as const,
  green: [101, 129, 79] as const, // #65814f
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
        const w = img.naturalWidth || 480;
        const h = img.naturalHeight || 120;
        canvas.width = w;
        canvas.height = h;
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

/** Branded PDF export matching on-screen invoice preview. */
export async function downloadInvoicePdf(
  invoice: Invoice,
  locale: Locale = "en",
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  const copy = messagesFor(locale).invoiceDoc;
  const money = (n: number) =>
    formatMoney(n, invoice.currency, false, locale);
  const total = invoiceTotal(invoice);
  const logo = await logoDataUrl();

  // White page (preview sheet)
  rgb(doc, brand.white, "fill");
  doc.rect(0, 0, pageW, pageH, "F");

  // Brand color stripe (same 5 bands as CRM)
  const stripeH = 2.2;
  const bandW = pageW / brand.stripe.length;
  brand.stripe.forEach((c, i) => {
    rgb(doc, c, "fill");
    doc.rect(i * bandW, 0, bandW + 0.2, stripeH, "F");
  });

  // Teal header block
  const headerTop = stripeH;
  const headerH = 42;
  rgb(doc, brand.teal, "fill");
  doc.rect(0, headerTop, pageW, headerH, "F");
  // subtle deep edge at bottom of header
  rgb(doc, brand.tealDeep, "fill");
  doc.rect(0, headerTop + headerH - 1.2, pageW, 1.2, "F");

  let y = headerTop + 10;

  if (logo) {
    // Logo on dark teal — keep readable width
    const logoW = 42;
    const logoH = 11;
    doc.addImage(logo, "PNG", margin, y - 4, logoW, logoH);
  } else {
    rgb(doc, brand.white, "text");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(invoiceCompany.name, margin, y + 2);
  }

  rgb(doc, brand.white, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const tagline = doc.splitTextToSize(
    `${copy.tagline}\n${invoiceCompany.address}`,
    95,
  );
  doc.text(tagline, margin, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(copy.invoice.toUpperCase(), pageW - margin, y + 2, { align: "right" });
  rgb(doc, brand.gold, "text");
  doc.setFontSize(12);
  doc.text(invoice.number, pageW - margin, y + 11, { align: "right" });

  y = headerTop + headerH + 12;

  // Meta labels
  rgb(doc, brand.mute, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(copy.number.toUpperCase(), margin, y);
  doc.text(copy.issued.toUpperCase(), margin + 48, y);
  doc.text(copy.due.toUpperCase(), margin + 96, y);
  if (invoice.paidDate) doc.text(copy.paid.toUpperCase(), margin + 144, y);

  y += 5;
  rgb(doc, brand.ink, "text");
  doc.setFontSize(10);
  doc.text(invoice.number, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(invoice.issueDate, locale), margin + 48, y);
  doc.text(formatDate(invoice.dueDate, locale), margin + 96, y);
  if (invoice.paidDate) {
    doc.text(formatDate(invoice.paidDate, locale), margin + 144, y);
  }

  y += 12;
  // Gold accent rule
  rgb(doc, brand.gold, "fill");
  doc.rect(margin, y - 4, 18, 0.7, "F");

  const col2 = margin + contentW / 2 + 2;
  rgb(doc, brand.mute, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(copy.from.toUpperCase(), margin, y);
  doc.text(copy.billTo.toUpperCase(), col2, y);

  y += 5;
  rgb(doc, brand.ink, "text");
  doc.setFontSize(10);
  doc.text(invoiceCompany.name, margin, y);
  doc.text(invoice.client, col2, y);

  y += 5;
  rgb(doc, brand.body, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(invoiceCompany.email, margin, y);
  doc.text(invoice.email, col2, y);
  y += 4.5;
  doc.text(invoiceCompany.phone, margin, y);
  let billExtra = 0;
  if (invoice.clientAddress) {
    const addr = doc.splitTextToSize(invoice.clientAddress, contentW / 2 - 6);
    doc.text(addr, col2, y);
    billExtra = Math.max(0, (addr.length - 1) * 4);
  }
  y += 4.5;
  doc.text(invoiceCompany.website, margin, y);
  y += Math.max(10, billExtra + 8);

  // Table header
  const tableX = margin;
  rgb(doc, brand.teal, "fill");
  doc.rect(tableX, y - 5, contentW, 9, "F");
  rgb(doc, brand.white, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(copy.description.toUpperCase(), tableX + 3, y);
  doc.text(copy.qty.toUpperCase(), tableX + contentW * 0.58, y, { align: "right" });
  doc.text(copy.unit.toUpperCase(), tableX + contentW * 0.76, y, { align: "right" });
  doc.text(copy.amount.toUpperCase(), tableX + contentW - 3, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  invoice.lines.forEach((line, idx) => {
    if (y > 255) {
      doc.addPage();
      rgb(doc, brand.white, "fill");
      doc.rect(0, 0, pageW, pageH, "F");
      y = margin + 8;
    }
    const desc = doc.splitTextToSize(line.description, contentW * 0.5);
    const rowH = Math.max(8, desc.length * 4.2 + 2);

    if (idx % 2 === 1) {
      doc.setFillColor(248, 246, 241);
      doc.rect(tableX, y - 4.5, contentW, rowH, "F");
    }

    rgb(doc, brand.ink, "text");
    doc.text(desc, tableX + 3, y);
    doc.text(String(line.qty), tableX + contentW * 0.58, y, { align: "right" });
    doc.text(money(line.unitPrice), tableX + contentW * 0.76, y, {
      align: "right",
    });
    doc.setFont("helvetica", "bold");
    doc.text(money(line.qty * line.unitPrice), tableX + contentW - 3, y, {
      align: "right",
    });
    doc.setFont("helvetica", "normal");

    y += rowH;
    rgb(doc, brand.line, "draw");
    doc.setLineWidth(0.2);
    doc.line(tableX, y - 4, tableX + contentW, y - 4);
  });

  y += 4;
  // Cream total box + teal label
  const boxW = 72;
  const boxX = margin + contentW - boxW;
  rgb(doc, brand.cream, "fill");
  doc.rect(boxX, y - 3, boxW, 18, "F");
  rgb(doc, brand.pink, "fill");
  doc.rect(boxX, y - 3, 1.4, 18, "F");
  rgb(doc, brand.teal, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(copy.total.toUpperCase(), boxX + 5, y + 3);
  doc.setFontSize(16);
  doc.text(money(total), boxX + boxW - 4, y + 11, { align: "right" });

  y += 26;
  rgb(doc, brand.body, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const notes = invoice.notes || copy.paymentNote;
  const noteLines = doc.splitTextToSize(notes, contentW);
  doc.text(noteLines, margin, y);
  y += noteLines.length * 3.8 + 6;

  rgb(doc, brand.teal, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(copy.thanks, margin, y);

  // Footer stripe
  brand.stripe.forEach((c, i) => {
    rgb(doc, c, "fill");
    doc.rect(i * bandW, pageH - stripeH, bandW + 0.2, stripeH, "F");
  });

  // Status stamp
  if (
    invoice.status === "draft" ||
    invoice.status === "void" ||
    invoice.status === "paid" ||
    invoice.status === "overdue"
  ) {
    const stampColor =
      invoice.status === "paid"
        ? brand.green
        : invoice.status === "void"
          ? brand.wine
          : invoice.status === "overdue"
            ? brand.pink
            : brand.mute;
    const stampText =
      invoice.status === "paid"
        ? copy.stampPaid
        : invoice.status === "void"
          ? copy.stampVoid
          : invoice.status === "overdue"
            ? copy.stampOverdue
            : copy.stampDraft;
    rgb(doc, stampColor, "text");
    rgb(doc, stampColor, "draw");
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(stampText, pageW / 2, 130, {
      align: "center",
      angle: 18,
    });
  }

  doc.save(`${invoice.number}.pdf`);
}

/** Legal & contact details shown on quotations, invoices, and related emails. */
export const invoiceCompany = {
  name: "Inkamoto Tours E.I.R.L.",
  legalName: "Inkamoto Tours E.I.R.L.",
  ruc: "20 60 21 90 201",
  tagline: "Motorcycle road trips in Peru",
  email: "contact@inkamototours.com",
  website: "www.inkamototours.com",
  /** Street + city/region for documents */
  street: "Calle Juan Matta S/N - Nasca",
  cityRegion: "Ica - Perú",
  phonePeru: "0051 913 303 521",
  phoneBelgium: "0032 499.189.172",
  /** Primary phone (legacy single-field consumers) */
  phone: "0051 913 303 521",
  paymentNote:
    "Please quote the invoice number as the payment reference.",
} as const;

/** Compact one-line address (headers with limited space). */
export function invoiceCompanyAddressLine() {
  return `${invoiceCompany.street}, ${invoiceCompany.cityRegion}`;
}

/** Multi-line block for “From” sections on quote/invoice. */
export function invoiceCompanyFromLines() {
  return [
    invoiceCompany.name,
    `R.U.C. : ${invoiceCompany.ruc}`,
    invoiceCompany.street,
    invoiceCompany.cityRegion,
    `Pérou : ${invoiceCompany.phonePeru}`,
    `Belgique : ${invoiceCompany.phoneBelgium}`,
    invoiceCompany.email,
  ];
}

export function invoiceCompanyFromText() {
  return invoiceCompanyFromLines().join("\n");
}

/** Short phones line for emails / footers. */
export function invoiceCompanyPhonesLine() {
  return `Pérou : ${invoiceCompany.phonePeru} · Belgique : ${invoiceCompany.phoneBelgium}`;
}

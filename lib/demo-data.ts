export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "won"
  | "lost";

export type LeadSource =
  | "google"
  | "meta"
  | "organic"
  | "referral"
  | "manual"
  | "website";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export type AdStatus = "active" | "paused" | "ended";

export type NewsletterStatus = "draft" | "scheduled" | "sent" | "archived";

export type InquiryChannel =
  | "contact_form"
  | "yanga_care"
  | "product_question"
  | "shipping_help"
  | "wholesale";

export type InquiryStatus = "new" | "triaged" | "converted" | "closed";

export type FollowUpStatus = "open" | "done" | "overdue";

export type SaleStatus =
  | "pending"
  | "confirmed"
  | "fulfilled"
  | "cancelled";

export type SiteInquiry = {
  id: string;
  name: string;
  email: string;
  channel: InquiryChannel;
  subject: string;
  message: string;
  page: string;
  status: InquiryStatus;
  createdAt: string;
  leadId: string | null;
  owner: string;
};

export type FollowUp = {
  id: string;
  title: string;
  relatedTo: string;
  relatedType: "inquiry" | "lead" | "sale";
  relatedId: string;
  dueAt: string;
  status: FollowUpStatus;
  owner: string;
  notes: string;
  createdAt: string;
};

export type Sale = {
  id: string;
  number: string;
  customer: string;
  email: string;
  product: string;
  amount: number;
  currency: "USD";
  status: SaleStatus;
  source: "website" | "lead" | "ads" | "newsletter";
  inquiryId: string | null;
  leadId: string | null;
  createdAt: string;
  closedAt: string | null;
  notes: string;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  currency: "USD";
  owner: string;
  createdAt: string;
  lastContact: string;
  notes: string;
};

export type AdCampaign = {
  id: string;
  name: string;
  platform: "google" | "meta";
  status: AdStatus;
  objective: string;
  spend: number;
  budget: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  startDate: string;
  endDate: string | null;
};

export type InvoiceLine = {
  description: string;
  qty: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  number: string;
  client: string;
  email: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
  currency: "USD" | "EUR";
  lines: InvoiceLine[];
  notes: string;
  clientAddress?: string;
};

export type Newsletter = {
  id: string;
  name: string;
  subject: string;
  status: NewsletterStatus;
  audience: string;
  recipients: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  preview: string;
};

export type AnalyticsPoint = {
  label: string;
  revenue: number;
  leads: number;
  adSpend: number;
  subscribers: number;
};

export const leads: Lead[] = [
  {
    id: "ld_1001",
    name: "Jessica Morgan",
    email: "jessica@brightbeauty.com",
    phone: "+1 (312) 555-0192",
    company: "Bright Beauty Co.",
    source: "google",
    status: "qualified",
    value: 8400,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-07-28",
    lastContact: "2026-08-07",
    notes: "Wants CRM + ads reporting for multi-brand beauty retail.",
  },
  {
    id: "ld_1002",
    name: "Marcus Webb",
    email: "marcus@northline.co",
    phone: "+1 (415) 555-0144",
    company: "Northline Co.",
    source: "meta",
    status: "contacted",
    value: 3200,
    currency: "USD",
    owner: "Sarah M.",
    createdAt: "2026-08-01",
    lastContact: "2026-08-06",
    notes: "Asked about Meta retargeting for skincare launches.",
  },
  {
    id: "ld_1003",
    name: "Olivia Grant",
    email: "olivia@lumenstudio.com",
    phone: "+1 (646) 555-0188",
    company: "Lumen Studio",
    source: "organic",
    status: "new",
    value: 5400,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-08-08",
    lastContact: "2026-08-08",
    notes: "Inbound from yangaa.store pricing page.",
  },
  {
    id: "ld_1004",
    name: "Ryan Patel",
    email: "ryan@orbitretail.com",
    phone: "+1 (206) 555-0171",
    company: "Orbit Retail",
    source: "referral",
    status: "won",
    value: 12600,
    currency: "USD",
    owner: "Sarah M.",
    createdAt: "2026-06-12",
    lastContact: "2026-07-30",
    notes: "Closed on Growth plan + invoicing module.",
  },
  {
    id: "ld_1005",
    name: "Elena Costa",
    email: "elena@casaverde.com",
    phone: "+1 (718) 555-0119",
    company: "Casa Verde Beauty",
    source: "google",
    status: "lost",
    value: 2800,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-07-02",
    lastContact: "2026-07-22",
    notes: "Chose a local agency instead.",
  },
  {
    id: "ld_1006",
    name: "Chris Delgado",
    email: "chris@summitretail.com",
    phone: "+1 (512) 555-0164",
    company: "Summit Retail",
    source: "meta",
    status: "qualified",
    value: 7100,
    currency: "USD",
    owner: "James R.",
    createdAt: "2026-07-19",
    lastContact: "2026-08-05",
    notes: "Needs Google + Meta lead sync.",
  },
  {
    id: "ld_1007",
    name: "Priya Shah",
    email: "priya@silkroute.io",
    phone: "+1 (617) 555-0133",
    company: "Silk Route",
    source: "manual",
    status: "contacted",
    value: 4600,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-08-03",
    lastContact: "2026-08-08",
    notes: "Discovery call booked for next week.",
  },
  {
    id: "ld_1008",
    name: "Emily Foster",
    email: "emily@glowmarket.com",
    phone: "+1 (305) 555-0199",
    company: "Glow Market",
    source: "website",
    status: "new",
    value: 3900,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-08-09",
    lastContact: "2026-08-09",
    notes: "Converted from yangaa.store contact form — wholesale inquiry.",
  },
  {
    id: "ld_1009",
    name: "Hannah Brooks",
    email: "hannah.brooks@gmail.com",
    phone: "+1 (212) 555-0148",
    company: "Personal",
    source: "website",
    status: "contacted",
    value: 186,
    currency: "USD",
    owner: "Sarah M.",
    createdAt: "2026-08-08",
    lastContact: "2026-08-09",
    notes:
      "YANGAA Care chat asked about SPF routine — follow-up for sale. Prefers fragrance-free kits.",
  },
  {
    id: "ld_1010",
    name: "Michael Reed",
    email: "mreed@northclinic.com",
    phone: "+1 (303) 555-0127",
    company: "North Clinic MedSpa",
    source: "website",
    status: "new",
    value: 18400,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-08-09",
    lastContact: "2026-08-09",
    notes:
      "Wholesale clinic partnership — 4 locations need recurring Avène + ISDIN. High priority for Q3.",
  },
  {
    id: "ld_1011",
    name: "Taylor Kim",
    email: "taylor@atelierskin.co",
    phone: "+1 (213) 555-0155",
    company: "Atelier Skin LA",
    source: "referral",
    status: "qualified",
    value: 9200,
    currency: "USD",
    owner: "Sarah M.",
    createdAt: "2026-07-24",
    lastContact: "2026-08-04",
    notes:
      "Referred by Orbit Retail. Wants exclusive LA launch kit + staff training webinar.",
  },
  {
    id: "ld_1012",
    name: "Jordan Blake",
    email: "jordan@rivermarket.us",
    phone: "+1 (504) 555-0180",
    company: "River Market Collective",
    source: "organic",
    status: "contacted",
    value: 4100,
    currency: "USD",
    owner: "James R.",
    createdAt: "2026-08-02",
    lastContact: "2026-08-03",
    notes:
      "Found yangaa.store via Google Organic. Asking about pop-up wholesale for Jazz Fest week.",
  },
  {
    id: "ld_1013",
    name: "Camille Dubois",
    email: "camille@maisonrose.fr",
    phone: "+1 (917) 555-0162",
    company: "Maison Rose NYC",
    source: "meta",
    status: "new",
    value: 6700,
    currency: "USD",
    owner: "Daniel C.",
    createdAt: "2026-08-07",
    lastContact: "2026-08-07",
    notes:
      "Meta lead form — boutique wants NUXE + Caudalie exclusive shelf. No reply yet (48h SLA).",
  },
  {
    id: "ld_1014",
    name: "Derek Hsu",
    email: "derek@pacificglow.com",
    phone: "+1 (808) 555-0194",
    company: "Pacific Glow",
    source: "google",
    status: "won",
    value: 15300,
    currency: "USD",
    owner: "James R.",
    createdAt: "2026-06-28",
    lastContact: "2026-07-28",
    notes: "Closed Hawaii distributor agreement. Upsell sunscreen season bundle Q4.",
  },
  {
    id: "ld_1015",
    name: "Nina Alvarez",
    email: "nina@solaclinic.com",
    phone: "+1 (619) 555-0112",
    company: "Sola Clinic",
    source: "website",
    status: "contacted",
    value: 11200,
    currency: "USD",
    owner: "Sarah M.",
    createdAt: "2026-07-30",
    lastContact: "2026-08-01",
    notes:
      "Product question + wholesale hybrid. Waiting on formulary list before proposal.",
  },
];

export const siteInquiries: SiteInquiry[] = [
  {
    id: "inq_01",
    name: "Emily Foster",
    email: "emily@glowmarket.com",
    channel: "contact_form",
    subject: "Wholesale / stockist application",
    message:
      "Hi — we run Glow Market in Miami and want to stock Yangaa curated skincare. Can someone share wholesale terms?",
    page: "yangaa.store/pages/contact",
    status: "converted",
    createdAt: "2026-08-09",
    leadId: "ld_1008",
    owner: "Daniel C.",
  },
  {
    id: "inq_02",
    name: "Hannah Brooks",
    email: "hannah.brooks@gmail.com",
    channel: "yanga_care",
    subject: "Which SPF for oily skin?",
    message:
      "Ask YANGAA Care: I have oily skin and need a daily SPF under $50. Any picks from the store?",
    page: "yangaa.store/ (YANGAA Care)",
    status: "converted",
    createdAt: "2026-08-08",
    leadId: "ld_1009",
    owner: "Sarah M.",
  },
  {
    id: "inq_03",
    name: "Noah Ellis",
    email: "noah.ellis@outlook.com",
    channel: "product_question",
    subject: "Is CeraVe Overnight Repair Mask in stock?",
    message:
      "Product page question — can you restock the 75ml overnight mask? Happy to buy two.",
    page: "yangaa.store/products/cerave-overnight-repair-mask",
    status: "new",
    createdAt: "2026-08-09",
    leadId: null,
    owner: "Daniel C.",
  },
  {
    id: "inq_04",
    name: "Ava Thompson",
    email: "ava.t@icloud.com",
    channel: "shipping_help",
    subject: "Where is my order YA-48291?",
    message:
      "Track order form submitted — shipped 3 days ago but tracking hasn’t moved.",
    page: "yangaa.store/pages/track-order",
    status: "triaged",
    createdAt: "2026-08-08",
    leadId: null,
    owner: "James R.",
  },
  {
    id: "inq_05",
    name: "Michael Reed",
    email: "mreed@northclinic.com",
    channel: "wholesale",
    subject: "Clinic supply partnership",
    message:
      "We operate 4 med-spas and want recurring Avène + ISDIN supply through Yangaa.",
    page: "yangaa.store/pages/wholesale",
    status: "converted",
    createdAt: "2026-08-09",
    leadId: "ld_1010",
    owner: "Daniel C.",
  },
  {
    id: "inq_06",
    name: "Sofia Nguyen",
    email: "sofia.nguyen@gmail.com",
    channel: "yanga_care",
    subject: "Return window for NUXE lotion?",
    message: "Bought last week — skin reacted. What’s your return policy?",
    page: "yangaa.store/ (YANGAA Care)",
    status: "closed",
    createdAt: "2026-08-06",
    leadId: null,
    owner: "Sarah M.",
  },
  {
    id: "inq_07",
    name: "Camille Dubois",
    email: "camille@maisonrose.fr",
    channel: "contact_form",
    subject: "Boutique partnership — NUXE shelf",
    message:
      "We run Maison Rose in SoHo. Interested in a curated NUXE + Caudalie shelf with staff samples.",
    page: "yangaa.store/pages/contact",
    status: "converted",
    createdAt: "2026-08-07",
    leadId: "ld_1013",
    owner: "Daniel C.",
  },
  {
    id: "inq_08",
    name: "Leo Martinez",
    email: "leo.m@proton.me",
    channel: "product_question",
    subject: "Difference between ISDIN Eryfotona vs Fusion Water?",
    message:
      "Which is better for outdoor tennis 3x/week? Looking to buy today if you recommend one.",
    page: "yangaa.store/products/isdin-eryfotona-actinicare",
    status: "new",
    createdAt: "2026-08-09",
    leadId: null,
    owner: "Sarah M.",
  },
  {
    id: "inq_09",
    name: "Grace Okonkwo",
    email: "grace@bloomapothecary.com",
    channel: "wholesale",
    subject: "Midwest distributor interest",
    message:
      "Bloom Apothecary covers IL/WI/IN. Want MOQ, exclusivity radius, and co-op ad budget details.",
    page: "yangaa.store/pages/wholesale",
    status: "triaged",
    createdAt: "2026-08-08",
    leadId: null,
    owner: "Daniel C.",
  },
  {
    id: "inq_10",
    name: "Ben Carter",
    email: "ben.carter@gmail.com",
    channel: "shipping_help",
    subject: "Wrong shade delivered — YA-49102",
    message:
      "Ordered foundation shade 20, received 30. Can you reship before my trip Friday?",
    page: "yangaa.store/pages/track-order",
    status: "new",
    createdAt: "2026-08-09",
    leadId: null,
    owner: "James R.",
  },
  {
    id: "inq_11",
    name: "Nina Alvarez",
    email: "nina@solaclinic.com",
    channel: "product_question",
    subject: "Clinic formulary — Avène Thermal Spring Water cases",
    message:
      "Need case pricing for 24-packs and whether we can white-label insert cards.",
    page: "yangaa.store/products/avene-thermal-spring-water",
    status: "converted",
    createdAt: "2026-07-30",
    leadId: "ld_1015",
    owner: "Sarah M.",
  },
  {
    id: "inq_12",
    name: "Priya Desai",
    email: "priya.desai@nyu.edu",
    channel: "yanga_care",
    subject: "Student discount on CeraVe bundle?",
    message:
      "YANGAA Care: Do you offer .edu discounts? Building a dorm skincare starter kit.",
    page: "yangaa.store/ (YANGAA Care)",
    status: "triaged",
    createdAt: "2026-08-09",
    leadId: null,
    owner: "Sarah M.",
  },
];

export const followUps: FollowUp[] = [
  {
    id: "fu_01",
    title: "Send wholesale packet to Emily Foster",
    relatedTo: "Emily Foster · Glow Market",
    relatedType: "lead",
    relatedId: "ld_1008",
    dueAt: "2026-08-10",
    status: "open",
    owner: "Daniel C.",
    notes: "Came from yangaa.store contact form. Attach price sheet + MOQ.",
    createdAt: "2026-08-09",
  },
  {
    id: "fu_02",
    title: "Recommend SPF bundle to Hannah Brooks",
    relatedTo: "Hannah Brooks",
    relatedType: "lead",
    relatedId: "ld_1009",
    dueAt: "2026-08-09",
    status: "overdue",
    owner: "Sarah M.",
    notes: "Originated in YANGAA Care chat. Push Heliocare + cleanser kit.",
    createdAt: "2026-08-08",
  },
  {
    id: "fu_03",
    title: "Reply: CeraVe mask restock ETA",
    relatedTo: "Noah Ellis",
    relatedType: "inquiry",
    relatedId: "inq_03",
    dueAt: "2026-08-09",
    status: "open",
    owner: "Daniel C.",
    notes: "Product question from store PDP. Convert to sale when back in stock.",
    createdAt: "2026-08-09",
  },
  {
    id: "fu_04",
    title: "Clinic partnership intro call",
    relatedTo: "Michael Reed · North Clinic",
    relatedType: "inquiry",
    relatedId: "inq_05",
    dueAt: "2026-08-11",
    status: "open",
    owner: "Daniel C.",
    notes: "Wholesale inquiry from yangaa.store — create lead after call.",
    createdAt: "2026-08-09",
  },
  {
    id: "fu_05",
    title: "Confirm shipping update for YA-48291",
    relatedTo: "Ava Thompson",
    relatedType: "inquiry",
    relatedId: "inq_04",
    dueAt: "2026-08-08",
    status: "done",
    owner: "James R.",
    notes: "Carrier delay explained. Keep as closed support case.",
    createdAt: "2026-08-08",
  },
  {
    id: "fu_06",
    title: "First outreach — Camille / Maison Rose",
    relatedTo: "Camille Dubois · Maison Rose NYC",
    relatedType: "lead",
    relatedId: "ld_1013",
    dueAt: "2026-08-09",
    status: "overdue",
    owner: "Daniel C.",
    notes: "48h SLA breached on Meta→website lead. Send boutique intro + lookbook.",
    createdAt: "2026-08-07",
  },
  {
    id: "fu_07",
    title: "North Clinic partnership deck",
    relatedTo: "Michael Reed · North Clinic MedSpa",
    relatedType: "lead",
    relatedId: "ld_1010",
    dueAt: "2026-08-10",
    status: "open",
    owner: "Daniel C.",
    notes: "Include multi-location pricing tiers and sample allocation.",
    createdAt: "2026-08-09",
  },
  {
    id: "fu_08",
    title: "Reply ISDIN SPF comparison for Leo",
    relatedTo: "Leo Martinez",
    relatedType: "inquiry",
    relatedId: "inq_08",
    dueAt: "2026-08-09",
    status: "open",
    owner: "Sarah M.",
    notes: "High purchase intent on PDP question — convert after recommendation.",
    createdAt: "2026-08-09",
  },
  {
    id: "fu_09",
    title: "Send Midwest distributor packet to Bloom",
    relatedTo: "Grace Okonkwo · Bloom Apothecary",
    relatedType: "inquiry",
    relatedId: "inq_09",
    dueAt: "2026-08-12",
    status: "open",
    owner: "Daniel C.",
    notes: "Triaged wholesale — exclusivity radius draft needed from legal.",
    createdAt: "2026-08-08",
  },
  {
    id: "fu_10",
    title: "Reship wrong shade YA-49102",
    relatedTo: "Ben Carter",
    relatedType: "inquiry",
    relatedId: "inq_10",
    dueAt: "2026-08-09",
    status: "overdue",
    owner: "James R.",
    notes: "Customer traveling Friday — escalate warehouse same-day if possible.",
    createdAt: "2026-08-09",
  },
  {
    id: "fu_11",
    title: "Atelier Skin exclusive kit proposal",
    relatedTo: "Taylor Kim · Atelier Skin LA",
    relatedType: "lead",
    relatedId: "ld_1011",
    dueAt: "2026-08-11",
    status: "open",
    owner: "Sarah M.",
    notes: "Qualified — send training webinar dates + exclusive SKU list.",
    createdAt: "2026-08-04",
  },
  {
    id: "fu_12",
    title: "Nudge Sola Clinic formulary reply",
    relatedTo: "Nina Alvarez · Sola Clinic",
    relatedType: "lead",
    relatedId: "ld_1015",
    dueAt: "2026-08-08",
    status: "overdue",
    owner: "Sarah M.",
    notes: "No contact since Aug 1 — stale lead risk. Ping with case pricing PDF.",
    createdAt: "2026-08-02",
  },
];

export const sales: Sale[] = [
  {
    id: "sale_01",
    number: "SL-2026-118",
    customer: "Hannah Brooks",
    email: "hannah.brooks@gmail.com",
    product: "Heliocare Daily Moisturizer + Avène Cleanser kit",
    amount: 108.76,
    currency: "USD",
    status: "confirmed",
    source: "website",
    inquiryId: "inq_02",
    leadId: "ld_1009",
    createdAt: "2026-08-09",
    closedAt: null,
    notes: "Sale from YANGAA Care follow-up on yangaa.store.",
  },
  {
    id: "sale_02",
    number: "SL-2026-117",
    customer: "Jordan Lee",
    email: "jordan.lee@gmail.com",
    product: "CeraVe Overnight Repair Mask 75ml ×2",
    amount: 168.44,
    currency: "USD",
    status: "fulfilled",
    source: "website",
    inquiryId: null,
    leadId: null,
    createdAt: "2026-08-07",
    closedAt: "2026-08-08",
    notes: "Direct checkout after product Q&A on store.",
  },
  {
    id: "sale_03",
    number: "SL-2026-116",
    customer: "Orbit Retail",
    email: "ryan@orbitretail.com",
    product: "Wholesale restock — curated skincare assortment",
    amount: 18600,
    currency: "USD",
    status: "fulfilled",
    source: "lead",
    inquiryId: null,
    leadId: "ld_1004",
    createdAt: "2026-07-28",
    closedAt: "2026-07-30",
    notes: "B2B wholesale closed from qualified lead — high margin reorder.",
  },
  {
    id: "sale_04",
    number: "SL-2026-119",
    customer: "Michael Reed",
    email: "mreed@northclinic.com",
    product: "Clinic starter assortment (Avène + ISDIN)",
    amount: 8640,
    currency: "USD",
    status: "confirmed",
    source: "website",
    inquiryId: "inq_05",
    leadId: "ld_1010",
    createdAt: "2026-08-09",
    closedAt: null,
    notes: "Wholesale clinic PO confirmed after site inquiry follow-up.",
  },
  {
    id: "sale_05",
    number: "SL-2026-115",
    customer: "Priya Shah",
    email: "priya@silkroute.io",
    product: "Pilot assortment (3 cases)",
    amount: 540,
    currency: "USD",
    status: "cancelled",
    source: "lead",
    inquiryId: null,
    leadId: "ld_1007",
    createdAt: "2026-08-04",
    closedAt: "2026-08-06",
    notes: "Deferred until discovery workshop completes.",
  },
  {
    id: "sale_06",
    number: "SL-2026-114",
    customer: "Pacific Glow",
    email: "derek@pacificglow.com",
    product: "Hawaii distributor agreement — opening inventory",
    amount: 22400,
    currency: "USD",
    status: "fulfilled",
    source: "lead",
    inquiryId: null,
    leadId: "ld_1014",
    createdAt: "2026-07-22",
    closedAt: "2026-07-28",
    notes: "Won distributor deal — sunscreen season stock fully paid.",
  },
  {
    id: "sale_07",
    number: "SL-2026-113",
    customer: "Bright Beauty Co.",
    email: "jessica@brightbeauty.com",
    product: "Multi-brand beauty retail assortment + training",
    amount: 12800,
    currency: "USD",
    status: "fulfilled",
    source: "ads",
    inquiryId: null,
    leadId: "ld_1001",
    createdAt: "2026-08-02",
    closedAt: "2026-08-05",
    notes: "Google Ads → qualified → closed. Strong ROAS contribution.",
  },
  {
    id: "sale_08",
    number: "SL-2026-112",
    customer: "Atelier Skin LA",
    email: "taylor@atelierskin.co",
    product: "Exclusive LA launch kit (NUXE + Caudalie)",
    amount: 9800,
    currency: "USD",
    status: "confirmed",
    source: "lead",
    inquiryId: null,
    leadId: "ld_1011",
    createdAt: "2026-08-06",
    closedAt: null,
    notes: "Referral wholesale — deposit cleared, ship week of Aug 11.",
  },
  {
    id: "sale_09",
    number: "SL-2026-111",
    customer: "Glow Market",
    email: "emily@glowmarket.com",
    product: "Miami stockist opening order",
    amount: 6400,
    currency: "USD",
    status: "fulfilled",
    source: "website",
    inquiryId: "inq_01",
    leadId: "ld_1008",
    createdAt: "2026-08-08",
    closedAt: "2026-08-09",
    notes: "Converted from yangaa.store contact form wholesale request.",
  },
  {
    id: "sale_10",
    number: "SL-2026-110",
    customer: "Summit Retail",
    email: "chris@summitretail.com",
    product: "Google + Meta synced catalog restock",
    amount: 11200,
    currency: "USD",
    status: "fulfilled",
    source: "ads",
    inquiryId: null,
    leadId: "ld_1006",
    createdAt: "2026-07-30",
    closedAt: "2026-08-03",
    notes: "Meta retargeting assisted close.",
  },
  {
    id: "sale_11",
    number: "SL-2026-109",
    customer: "DTC storefront (Aug week 1)",
    email: "orders@yangaa.store",
    product: "Direct-to-consumer checkout batch",
    amount: 18640,
    currency: "USD",
    status: "fulfilled",
    source: "website",
    inquiryId: null,
    leadId: null,
    createdAt: "2026-08-07",
    closedAt: "2026-08-08",
    notes: "Aggregated DTC orders from yangaa.store — healthy AOV week.",
  },
  {
    id: "sale_12",
    number: "SL-2026-108",
    customer: "DTC storefront (Jul)",
    email: "orders@yangaa.store",
    product: "Direct-to-consumer checkout batch",
    amount: 41280,
    currency: "USD",
    status: "fulfilled",
    source: "website",
    inquiryId: null,
    leadId: null,
    createdAt: "2026-07-31",
    closedAt: "2026-07-31",
    notes: "July DTC revenue — ads + organic + Care chat assists.",
  },
  {
    id: "sale_13",
    number: "SL-2026-107",
    customer: "Maison Rose NYC",
    email: "camille@maisonrose.fr",
    product: "Boutique NUXE + Caudalie shelf set",
    amount: 5200,
    currency: "USD",
    status: "pending",
    source: "ads",
    inquiryId: "inq_07",
    leadId: "ld_1013",
    createdAt: "2026-08-09",
    closedAt: null,
    notes: "Pending first outreach close — counted in pipeline not profit yet.",
  },
  {
    id: "sale_14",
    number: "SL-2026-106",
    customer: "Northline Co.",
    email: "marcus@northline.co",
    product: "Skincare launch assortment",
    amount: 7400,
    currency: "USD",
    status: "fulfilled",
    source: "ads",
    inquiryId: null,
    leadId: "ld_1002",
    createdAt: "2026-08-01",
    closedAt: "2026-08-06",
    notes: "Meta campaign assisted B2B order.",
  },
];

export const googleCampaigns: AdCampaign[] = [];

export const metaCampaigns: AdCampaign[] = [
  {
    id: "mad_01",
    name: "Prospecting — Lookalike 2%",
    platform: "meta",
    status: "active",
    objective: "Leads",
    spend: 6640,
    budget: 8500,
    impressions: 812400,
    clicks: 10420,
    conversions: 1146,
    ctr: 1.3,
    cpc: 0.64,
    roas: 6.8,
    startDate: "2026-06-10",
    endDate: null,
  },
  {
    id: "mad_02",
    name: "Retarget — Site Visitors 30d",
    platform: "meta",
    status: "active",
    objective: "Conversions",
    spend: 2480,
    budget: 3000,
    impressions: 245800,
    clicks: 6120,
    conversions: 856,
    ctr: 2.5,
    cpc: 0.41,
    roas: 9.1,
    startDate: "2026-07-05",
    endDate: null,
  },
  {
    id: "mad_03",
    name: "Awareness — Summer Glow",
    platform: "meta",
    status: "ended",
    objective: "Reach",
    spend: 3720,
    budget: 3720,
    impressions: 1540000,
    clicks: 18800,
    conversions: 1128,
    ctr: 1.2,
    cpc: 0.2,
    roas: 4.6,
    startDate: "2026-03-01",
    endDate: "2026-04-15",
  },
  {
    id: "mad_04",
    name: "Leads — Newsletter Offer",
    platform: "meta",
    status: "paused",
    objective: "Leads",
    spend: 1480,
    budget: 2600,
    impressions: 198200,
    clicks: 2740,
    conversions: 356,
    ctr: 1.4,
    cpc: 0.54,
    roas: 7.4,
    startDate: "2026-07-20",
    endDate: null,
  },
];

export const invoices: Invoice[] = [
  {
    id: "inv_2201",
    number: "YNG-2026-014",
    client: "Orbit Retail",
    email: "billing@orbitretail.com",
    status: "paid",
    issueDate: "2026-07-01",
    dueDate: "2026-07-15",
    paidDate: "2026-07-12",
    currency: "USD",
    lines: [
      { description: "Wholesale restock — Jul 2026", qty: 1, unitPrice: 12600 },
      { description: "Staff training webinar", qty: 1, unitPrice: 1800 },
    ],
    notes: "Paid via ACH.",
  },
  {
    id: "inv_2202",
    number: "YNG-2026-015",
    client: "Bright Beauty Co.",
    email: "finance@brightbeauty.com",
    status: "paid",
    issueDate: "2026-08-01",
    dueDate: "2026-08-15",
    paidDate: "2026-08-08",
    currency: "USD",
    lines: [
      { description: "Multi-brand assortment", qty: 1, unitPrice: 9800 },
      { description: "Google Ads co-op credit", qty: 1, unitPrice: 1500 },
    ],
    notes: "Paid early — Net 14.",
  },
  {
    id: "inv_2203",
    number: "YNG-2026-016",
    client: "Summit Retail",
    email: "accounts@summitretail.com",
    status: "sent",
    issueDate: "2026-07-10",
    dueDate: "2026-08-24",
    paidDate: null,
    currency: "USD",
    lines: [
      { description: "Catalog restock — Aug", qty: 1, unitPrice: 6200 },
      { description: "Creative pack (5 assets)", qty: 1, unitPrice: 750 },
    ],
    notes: "Reminder scheduled Aug 12.",
  },
  {
    id: "inv_2204",
    number: "YNG-2026-017",
    client: "Silk Route",
    email: "priya@silkroute.io",
    status: "draft",
    issueDate: "2026-08-08",
    dueDate: "2026-08-22",
    paidDate: null,
    currency: "USD",
    lines: [
      { description: "Discovery workshop", qty: 1, unitPrice: 900 },
      { description: "Pilot cases (3)", qty: 3, unitPrice: 420 },
    ],
    notes: "Awaiting approval before send.",
  },
  {
    id: "inv_2205",
    number: "YNG-2026-013",
    client: "Pacific Glow",
    email: "derek@pacificglow.com",
    status: "paid",
    issueDate: "2026-06-18",
    dueDate: "2026-07-02",
    paidDate: "2026-06-30",
    currency: "USD",
    lines: [
      { description: "Distributor opening inventory", qty: 1, unitPrice: 18400 },
      { description: "Freight prepaid", qty: 1, unitPrice: 2100 },
    ],
    notes: "Hawaii distributor — paid in full.",
  },
  {
    id: "inv_2206",
    number: "YNG-2026-012",
    client: "Casa Verde Beauty",
    email: "elena@casaverde.com",
    status: "void",
    issueDate: "2026-07-05",
    dueDate: "2026-07-19",
    paidDate: null,
    currency: "USD",
    lines: [{ description: "Starter assortment — Jul", qty: 1, unitPrice: 890 }],
    notes: "Voided after deal lost.",
  },
  {
    id: "inv_2207",
    number: "YNG-2026-018",
    client: "Glow Market",
    email: "emily@glowmarket.com",
    status: "paid",
    issueDate: "2026-08-08",
    dueDate: "2026-08-22",
    paidDate: "2026-08-09",
    currency: "USD",
    lines: [
      { description: "Miami stockist opening order", qty: 1, unitPrice: 6400 },
    ],
    notes: "Paid on confirmation from website wholesale lead.",
  },
  {
    id: "inv_2208",
    number: "YNG-2026-019",
    client: "Atelier Skin LA",
    email: "taylor@atelierskin.co",
    status: "paid",
    issueDate: "2026-08-06",
    dueDate: "2026-08-20",
    paidDate: "2026-08-07",
    currency: "USD",
    lines: [
      { description: "Exclusive LA launch kit deposit", qty: 1, unitPrice: 9800 },
    ],
    notes: "Deposit cleared — profitable wholesale lane.",
  },
];

export const newsletters: Newsletter[] = [
  {
    id: "nl_01",
    name: "August Glow Edit",
    subject: "Your August glow edit is here ✨",
    status: "draft",
    audience: "All subscribers",
    recipients: 18420,
    opens: 0,
    clicks: 0,
    unsubscribes: 0,
    scheduledAt: null,
    sentAt: null,
    createdAt: "2026-08-08",
    preview: "Curated serums, SPF picks, and early access deals from yangaa.store.",
  },
  {
    id: "nl_02",
    name: "Weekend Flash Deals",
    subject: "48-hour flash deals on cleansers & SPF",
    status: "sent",
    audience: "Engaged 90d",
    recipients: 12640,
    opens: 4820,
    clicks: 1198,
    unsubscribes: 34,
    scheduledAt: null,
    sentAt: "2026-08-02",
    createdAt: "2026-07-31",
    preview: "Save up to 25% on Avène, CeraVe, and Heliocare essentials.",
  },
  {
    id: "nl_03",
    name: "New Arrivals — NUXE",
    subject: "NUXE just landed — shop first",
    status: "sent",
    audience: "VIP buyers",
    recipients: 4820,
    opens: 2410,
    clicks: 886,
    unsubscribes: 9,
    scheduledAt: null,
    sentAt: "2026-07-18",
    createdAt: "2026-07-16",
    preview: "Body care favorites from NUXE, exclusive to yangaa subscribers.",
  },
  {
    id: "nl_04",
    name: "Back-to-Routine Reminder",
    subject: "Rebuild your skincare routine this fall",
    status: "scheduled",
    audience: "All subscribers",
    recipients: 18420,
    opens: 0,
    clicks: 0,
    unsubscribes: 0,
    scheduledAt: "2026-08-14",
    sentAt: null,
    createdAt: "2026-08-07",
    preview: "Moisturizers, overnight masks, and toner picks for cooler weather.",
  },
];

export const analyticsSeries: AnalyticsPoint[] = [
  { label: "Mar", revenue: 48200, leads: 42, adSpend: 6400, subscribers: 14200 },
  { label: "Apr", revenue: 53400, leads: 51, adSpend: 7100, subscribers: 15180 },
  { label: "May", revenue: 51850, leads: 47, adSpend: 6800, subscribers: 15940 },
  { label: "Jun", revenue: 62600, leads: 63, adSpend: 8200, subscribers: 16810 },
  { label: "Jul", revenue: 71200, leads: 71, adSpend: 9100, subscribers: 17640 },
  { label: "Aug", revenue: 58450, leads: 58, adSpend: 7600, subscribers: 18420 },
];

/** Monthly paid-media performance by platform */
export const adPerformanceSeries = [
  {
    label: "Mar",
    google: { impressions: 420000, clicks: 12400, conversions: 1480, spend: 3200 },
    meta: { impressions: 680000, clicks: 15200, conversions: 1680, spend: 3200 },
  },
  {
    label: "Apr",
    google: { impressions: 480000, clicks: 13800, conversions: 1650, spend: 3600 },
    meta: { impressions: 720000, clicks: 16800, conversions: 1920, spend: 3500 },
  },
  {
    label: "May",
    google: { impressions: 455000, clicks: 13100, conversions: 1570, spend: 3400 },
    meta: { impressions: 690000, clicks: 15900, conversions: 1810, spend: 3400 },
  },
  {
    label: "Jun",
    google: { impressions: 520000, clicks: 15200, conversions: 1860, spend: 4100 },
    meta: { impressions: 810000, clicks: 18400, conversions: 2140, spend: 4100 },
  },
  {
    label: "Jul",
    google: { impressions: 580000, clicks: 16800, conversions: 2120, spend: 4600 },
    meta: { impressions: 890000, clicks: 20100, conversions: 2410, spend: 4500 },
  },
  {
    label: "Aug",
    google: { impressions: 510000, clicks: 14900, conversions: 1840, spend: 3800 },
    meta: { impressions: 760000, clicks: 17600, conversions: 2110, spend: 3800 },
  },
];

export const channelMix = [
  { label: "Google Ads", value: 32, color: "#31595d" },
  { label: "Meta Ads", value: 26, color: "#e1736c" },
  { label: "Website", value: 22, color: "#624e8a" },
  { label: "Organic", value: 12, color: "#65814f" },
  { label: "Referral", value: 8, color: "#ecbb5a" },
];

export function invoiceTotal(invoice: Invoice) {
  return invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
}

export function newsletterOpenRate(n: Newsletter) {
  if (!n.recipients || n.status !== "sent") return 0;
  return (n.opens / n.recipients) * 100;
}

export function newsletterClickRate(n: Newsletter) {
  if (!n.recipients || n.status !== "sent") return 0;
  return (n.clicks / n.recipients) * 100;
}

export type CampaignSummary = {
  campaigns: number;
  active: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpa: number;
  avgRoas: number;
};

export function summarizeCampaigns(list: AdCampaign[]): CampaignSummary {
  const campaigns = list.length;
  const active = list.filter((c) => c.status === "active").length;
  const impressions = list.reduce((s, c) => s + c.impressions, 0);
  const clicks = list.reduce((s, c) => s + c.clicks, 0);
  const conversions = list.reduce((s, c) => s + c.conversions, 0);
  const spend = list.reduce((s, c) => s + c.spend, 0);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cvr = clicks ? (conversions / clicks) * 100 : 0;
  const cpc = clicks ? spend / clicks : 0;
  const cpa = conversions ? spend / conversions : 0;
  const avgRoas = campaigns
    ? list.reduce((s, c) => s + c.roas, 0) / campaigns
    : 0;

  return {
    campaigns,
    active,
    impressions,
    clicks,
    conversions,
    spend,
    ctr,
    cvr,
    cpc,
    cpa,
    avgRoas,
  };
}

export function conversionLevel(cvr: number) {
  if (cvr >= 5) return { label: "Excellent", tone: "success" as const };
  if (cvr >= 3) return { label: "Strong", tone: "info" as const };
  if (cvr >= 1.5) return { label: "Average", tone: "warning" as const };
  return { label: "Low", tone: "danger" as const };
}

export function campaignConvRate(c: AdCampaign) {
  return c.clicks ? (c.conversions / c.clicks) * 100 : 0;
}

export function getDashboardStats(input?: {
  leads?: Lead[];
  googleCampaigns?: AdCampaign[];
  metaCampaigns?: AdCampaign[];
  invoices?: Invoice[];
  newsletters?: Newsletter[];
  siteInquiries?: SiteInquiry[];
  followUps?: FollowUp[];
  sales?: Sale[];
}) {
  const leadList = input?.leads ?? [];
  const googleList = input?.googleCampaigns ?? [];
  const metaList = input?.metaCampaigns ?? [];
  const invoiceList = input?.invoices ?? [];
  const newsletterList = input?.newsletters ?? [];
  const inquiryList = input?.siteInquiries ?? [];
  const followUpList = input?.followUps ?? [];
  const saleList = input?.sales ?? [];

  const openLeads = leadList.filter((l) =>
    ["new", "contacted", "qualified"].includes(l.status),
  ).length;
  const pipelineValue = leadList
    .filter((l) => ["new", "contacted", "qualified"].includes(l.status))
    .reduce((sum, l) => sum + l.value, 0);
  const wonLeads = leadList.filter((l) => l.status === "won").length;

  const allAds = [...googleList, ...metaList];
  const adSpend = allAds.reduce((sum, c) => sum + c.spend, 0);
  const adConversions = allAds.reduce((sum, c) => sum + c.conversions, 0);
  const googleSpend = googleList.reduce((sum, c) => sum + c.spend, 0);
  const metaSpend = metaList.reduce((sum, c) => sum + c.spend, 0);

  const outstanding = invoiceList
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + invoiceTotal(i), 0);
  const paidCollections = invoiceList
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + invoiceTotal(i), 0);
  const paidCount = invoiceList.filter((i) => i.status === "paid").length;
  const overdueCount = invoiceList.filter((i) => i.status === "overdue").length;

  const sentNewsletters = newsletterList.filter((n) => n.status === "sent");
  const subscribers = Math.max(
    ...newsletterList.map((n) => n.recipients),
    0,
  );
  const avgOpenRate =
    sentNewsletters.length === 0
      ? 0
      : sentNewsletters.reduce((s, n) => s + newsletterOpenRate(n), 0) /
        sentNewsletters.length;

  const openInquiries = inquiryList.filter(
    (i) => i.status === "new" || i.status === "triaged",
  ).length;
  const openFollowUps = followUpList.filter(
    (f) => f.status === "open" || f.status === "overdue",
  ).length;

  const closedSales = saleList.filter(
    (s) => s.status === "confirmed" || s.status === "fulfilled",
  );
  const salesRevenue = closedSales.reduce((sum, s) => sum + s.amount, 0);
  const pendingSales = saleList.filter((s) => s.status === "pending").length;
  const websiteLeads = leadList.filter((l) => l.source === "website").length;

  // Optional estimated tour COGS rate (0–1). Default 0 until you set NEXT_PUBLIC_CRM_COGS_RATE.
  const cogsRateRaw = Number(
    process.env.NEXT_PUBLIC_CRM_COGS_RATE?.trim() || "0",
  );
  const cogsRate =
    Number.isFinite(cogsRateRaw) && cogsRateRaw >= 0 && cogsRateRaw <= 1
      ? cogsRateRaw
      : 0;

  const cutoff = monthsAgoIso(6);

  const trailingSales = closedSales.filter((s) =>
    inLastMonths(s.closedAt || s.createdAt, cutoff),
  );
  const periodRevenue = trailingSales.reduce((sum, s) => sum + s.amount, 0);

  const trailingPaidCollections = invoiceList
    .filter(
      (i) =>
        i.status === "paid" && inLastMonths(i.paidDate || i.issueDate, cutoff),
    )
    .reduce((sum, i) => sum + invoiceTotal(i), 0);

  // Campaign spend counted in trailing window if the campaign overlapped it.
  const periodAdSpend = allAds
    .filter((c) => {
      const started = c.startDate <= todayIso();
      const ended = !c.endDate || c.endDate >= cutoff;
      return started && ended && c.startDate <= todayIso();
    })
    .reduce((sum, c) => sum + c.spend, 0);

  const cogs = salesRevenue * cogsRate;
  const grossProfit = salesRevenue - cogs;
  const netProfit = grossProfit - adSpend;
  const profitMargin = salesRevenue ? (netProfit / salesRevenue) * 100 : 0;

  const periodCogs = periodRevenue * cogsRate;
  const periodGross = periodRevenue - periodCogs;
  const trailingProfit = periodGross - periodAdSpend;
  const trailingMargin = periodRevenue
    ? (trailingProfit / periodRevenue) * 100
    : 0;

  // Ad-attributed revenue only when campaign ROAS is present from live ads data.
  const adAttributedRevenue = allAds.reduce(
    (sum, c) => sum + (c.roas > 0 ? c.spend * c.roas : 0),
    0,
  );
  const adProfit = adAttributedRevenue - adSpend;
  const avgRoas = adSpend && adAttributedRevenue ? adAttributedRevenue / adSpend : 0;

  return {
    openLeads,
    pipelineValue,
    wonLeads,
    adSpend,
    adConversions,
    googleSpend,
    metaSpend,
    outstanding,
    paidCollections,
    paidCount,
    overdueCount,
    totalLeads: leadList.length,
    subscribers,
    avgOpenRate,
    newsletterDrafts: newsletterList.filter((n) => n.status === "draft").length,
    openInquiries,
    openFollowUps,
    salesRevenue,
    pendingSales,
    websiteLeads,
    cogs,
    cogsRate,
    grossProfit,
    netProfit,
    profitMargin,
    adAttributedRevenue,
    adProfit,
    avgRoas,
    periodRevenue,
    periodAdSpend,
    trailingPaidCollections,
    trailingProfit,
    trailingMargin,
    isProfitable: netProfit > 0,
  };
}

function monthsAgoIso(months: number) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function inLastMonths(iso: string, cutoffIso: string) {
  return iso.slice(0, 10) >= cutoffIso;
}

export const OWNERS = ["Daniel C.", "Sarah M.", "James R."] as const;

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function nextInvoiceNumber(existing: Invoice[]) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((i) => Number(i.number.split("-").pop()))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `INK-${year}-${String(next).padStart(3, "0")}`;
}

export function nextSaleNumber(existing: Sale[]) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((s) => Number(s.number.split("-").pop()))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SL-${year}-${String(next).padStart(3, "0")}`;
}

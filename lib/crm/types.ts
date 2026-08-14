import type {
  AdCampaign,
  FollowUp,
  FollowUpStatus,
  InquiryStatus,
  Invoice,
  InvoiceStatus,
  Lead,
  LeadSource,
  LeadStatus,
  Newsletter,
  Sale,
  SaleStatus,
  SiteInquiry,
} from "@/lib/demo-data";

export type CrmSnapshot = {
  leads: Lead[];
  invoices: Invoice[];
  siteInquiries: SiteInquiry[];
  followUps: FollowUp[];
  sales: Sale[];
  googleCampaigns: AdCampaign[];
  metaCampaigns: AdCampaign[];
  newsletters: Newsletter[];
};

export type CrmMutation =
  | {
      op: "addLead";
      input: {
        name: string;
        email: string;
        phone: string;
        company: string;
        source: LeadSource;
        status: LeadStatus;
        value: number;
        owner: string;
        notes: string;
      };
    }
  | { op: "updateLeadStatus"; id: string; status: LeadStatus }
  | {
      op: "addInvoice";
      input: {
        client: string;
        email: string;
        clientAddress: string;
        currency: "USD" | "EUR";
        dueDate: string;
        lines: { description: string; qty: number; unitPrice: number }[];
        notes: string;
        sendNow: boolean;
      };
    }
  | { op: "updateInvoiceStatus"; id: string; status: InvoiceStatus }
  | { op: "updateInquiryStatus"; id: string; status: InquiryStatus }
  | { op: "convertInquiryToLead"; id: string }
  | {
      op: "addFollowUp";
      input: {
        title: string;
        relatedTo: string;
        relatedType: "inquiry" | "lead" | "sale";
        relatedId: string;
        dueAt: string;
        owner: string;
        notes: string;
      };
    }
  | { op: "updateFollowUpStatus"; id: string; status: FollowUpStatus }
  | {
      op: "addSale";
      input: {
        customer: string;
        email: string;
        product: string;
        amount: number;
        source: Sale["source"];
        inquiryId: string | null;
        leadId: string | null;
        notes: string;
      };
    }
  | { op: "updateSaleStatus"; id: string; status: SaleStatus };

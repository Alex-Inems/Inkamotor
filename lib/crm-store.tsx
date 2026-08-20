"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CrmMutation, CrmSnapshot } from "@/lib/crm/types";
import {
  type AdCampaign,
  type AdStatus,
  type FollowUpStatus,
  type InquiryStatus,
  type InvoiceStatus,
  type LeadSource,
  type LeadStatus,
  type Newsletter,
  type NewsletterStatus,
  type Sale,
  type SaleStatus,
} from "@/lib/demo-data";

type Toast = { id: number; message: string };

type NewLeadInput = {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  currency: "USD";
  owner: string;
  notes: string;
};

type NewInvoiceInput = {
  client: string;
  email: string;
  clientAddress: string;
  currency: "USD" | "EUR";
  dueDate: string;
  lines: { description: string; qty: number; unitPrice: number }[];
  notes: string;
  sendNow: boolean;
};

type NewNewsletterInput = {
  name: string;
  subject: string;
  audience: string;
  recipients: number;
  preview: string;
  sendNow: boolean;
};

type NewFollowUpInput = {
  title: string;
  relatedTo: string;
  relatedType: "inquiry" | "lead" | "sale";
  relatedId: string;
  dueAt: string;
  owner: string;
  notes: string;
};

type NewSaleInput = {
  customer: string;
  email: string;
  product: string;
  amount: number;
  source: Sale["source"];
  inquiryId: string | null;
  leadId: string | null;
  notes: string;
};

type CrmStore = CrmSnapshot & {
  ready: boolean;
  loadError: string | null;
  toasts: Toast[];
  addLead: (input: NewLeadInput) => Promise<string>;
  updateLeadStatus: (id: string, status: LeadStatus) => Promise<void>;
  setCampaignStatus: (
    platform: "google" | "meta",
    id: string,
    status: AdStatus,
  ) => void;
  addInvoice: (input: NewInvoiceInput) => Promise<void>;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  addNewsletter: (input: NewNewsletterInput) => void;
  updateNewsletterStatus: (id: string, status: NewsletterStatus) => void;
  updateInquiryStatus: (id: string, status: InquiryStatus) => Promise<void>;
  convertInquiryToLead: (id: string) => Promise<void>;
  addFollowUp: (input: NewFollowUpInput) => Promise<void>;
  updateFollowUpStatus: (id: string, status: FollowUpStatus) => Promise<void>;
  addSale: (input: NewSaleInput) => Promise<void>;
  updateSaleStatus: (id: string, status: SaleStatus) => Promise<void>;
  resetDemo: () => void;
  refreshCrm: () => Promise<void>;
  pushToast: (message: string) => void;
  dismissToast: (id: number) => void;
};

const empty: CrmSnapshot = {
  leads: [],
  invoices: [],
  siteInquiries: [],
  followUps: [],
  sales: [],
  googleCampaigns: [],
  metaCampaigns: [],
  newsletters: [],
};

const CrmContext = createContext<CrmStore | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CrmSnapshot>(empty);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const pushToast = useCallback((message: string) => {
    // Ref counter avoids duplicate keys from Strict Mode double-invoking setState updaters.
    const id = ++toastSeq.current;
      setToasts((prev) => [...prev, { id, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshCrm = useCallback(async () => {
    const res = await fetch("/api/crm");
    const json = await res.json();
    if (!res.ok) {
      setLoadError((json as { error?: string }).error || "Could not load CRM");
      setData(empty);
      return;
    }
    setLoadError(null);
    setData(json as CrmSnapshot);
  }, []);

  useEffect(() => {
    refreshCrm().finally(() => setReady(true));
  }, [refreshCrm]);

  const mutate = useCallback(
    async (mutation: CrmMutation, okMessage: string) => {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as { error?: string }).error || "Save failed");
        throw new Error((json as { error?: string }).error || "Save failed");
      }
      setData(json as CrmSnapshot);
      setLoadError(null);
      pushToast(okMessage);
      return json as CrmSnapshot;
    },
    [pushToast],
  );

  const addLead = useCallback(
    async (input: NewLeadInput) => {
      const snap = await mutate(
        {
          op: "addLead",
          input: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            company: input.company,
            source: input.source,
            status: input.status,
            value: input.value,
            owner: input.owner,
            notes: input.notes,
          },
        },
        `Lead added: ${input.name}`,
      );
      return snap.leads[0]?.id ?? "";
    },
    [mutate],
  );

  const updateLeadStatus = useCallback(
    async (id: string, status: LeadStatus) => {
      await mutate({ op: "updateLeadStatus", id, status }, `Lead marked ${status}`);
    },
    [mutate],
  );

  const setCampaignStatus = useCallback(
    (_platform: "google" | "meta", _id: string, status: AdStatus) => {
      pushToast(`Meta Ads is demo-only until API keys are added (${status})`);
    },
    [pushToast],
  );

  const addInvoice = useCallback(
    async (input: NewInvoiceInput) => {
      await mutate(
        { op: "addInvoice", input },
        input.sendNow ? "Invoice saved as sent" : "Draft invoice created",
      );
    },
    [mutate],
  );

  const updateInvoiceStatus = useCallback(
    async (id: string, status: InvoiceStatus) => {
      await mutate(
        { op: "updateInvoiceStatus", id, status },
        `Invoice ${status}`,
      );
    },
    [mutate],
  );

  const addNewsletter = useCallback(
    (_input: NewNewsletterInput) => {
      pushToast("Use the Newsletter page to send campaigns");
    },
    [pushToast],
  );

  const updateNewsletterStatus = useCallback(
    (_id: string, _status: NewsletterStatus) => {
      pushToast("Newsletter status updates from your email account");
    },
    [pushToast],
  );

  const updateInquiryStatus = useCallback(
    async (id: string, status: InquiryStatus) => {
      await mutate(
        { op: "updateInquiryStatus", id, status },
        `Inquiry ${status}`,
      );
    },
    [mutate],
  );

  const convertInquiryToLead = useCallback(
    async (id: string) => {
      await mutate(
        { op: "convertInquiryToLead", id },
        "Inquiry converted to lead + follow-up",
      );
    },
    [mutate],
  );

  const addFollowUp = useCallback(
    async (input: NewFollowUpInput) => {
      await mutate({ op: "addFollowUp", input }, "Follow-up created");
    },
    [mutate],
  );

  const updateFollowUpStatus = useCallback(
    async (id: string, status: FollowUpStatus) => {
      await mutate(
        { op: "updateFollowUpStatus", id, status },
        `Follow-up ${status}`,
      );
    },
    [mutate],
  );

  const addSale = useCallback(
    async (input: NewSaleInput) => {
      await mutate({ op: "addSale", input }, "Sale created");
    },
    [mutate],
  );

  const updateSaleStatus = useCallback(
    async (id: string, status: SaleStatus) => {
      await mutate({ op: "updateSaleStatus", id, status }, `Sale ${status}`);
    },
    [mutate],
  );

  const resetDemo = useCallback(() => {
    pushToast("Demo reset is disabled in production");
  }, [pushToast]);

  const value = useMemo(
    () => ({
      ...data,
      ready,
      loadError,
      toasts,
      addLead,
      updateLeadStatus,
      setCampaignStatus,
      addInvoice,
      updateInvoiceStatus,
      addNewsletter,
      updateNewsletterStatus,
      updateInquiryStatus,
      convertInquiryToLead,
      addFollowUp,
      updateFollowUpStatus,
      addSale,
      updateSaleStatus,
      resetDemo,
      refreshCrm,
      pushToast,
      dismissToast,
    }),
    [
      data,
      ready,
      loadError,
      toasts,
      addLead,
      updateLeadStatus,
      setCampaignStatus,
      addInvoice,
      updateInvoiceStatus,
      addNewsletter,
      updateNewsletterStatus,
      updateInquiryStatus,
      convertInquiryToLead,
      addFollowUp,
      updateFollowUpStatus,
      addSale,
      updateSaleStatus,
      resetDemo,
      refreshCrm,
      pushToast,
      dismissToast,
    ],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used within CrmProvider");
  return ctx;
}

// keep Newsletter type import used for future
export type { Newsletter, AdCampaign };

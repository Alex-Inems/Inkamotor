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
import { useLocale } from "@/lib/i18n";
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
  const { t, locale } = useLocale();
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
    const res = await fetch(`/api/crm?locale=${locale}`);
    const json = await res.json();
    if (!res.ok) {
      setLoadError((json as { error?: string }).error || t("toast.loadFailed"));
      setData(empty);
      return;
    }
    setLoadError(null);
    setData(json as CrmSnapshot);
  }, [t, locale]);

  useEffect(() => {
    refreshCrm().finally(() => setReady(true));
  }, [refreshCrm]);

  const mutate = useCallback(
    async (mutation: CrmMutation, okMessage: string) => {
      const res = await fetch(`/api/crm?locale=${locale}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast((json as { error?: string }).error || t("toast.saveFailed"));
        throw new Error((json as { error?: string }).error || t("toast.saveFailed"));
      }
      setData(json as CrmSnapshot);
      setLoadError(null);
      pushToast(okMessage);
      return json as CrmSnapshot;
    },
    [pushToast, t, locale],
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
        t("toast.leadAdded", { name: input.name }),
      );
      return snap.leads.find((l) => l.email.toLowerCase() === input.email.trim().toLowerCase())
        ?.id ?? snap.leads[0]?.id ?? "";
    },
    [mutate, t],
  );

  const updateLeadStatus = useCallback(
    async (id: string, status: LeadStatus) => {
      await mutate(
        { op: "updateLeadStatus", id, status },
        t("toast.leadMarked", { status: t(`status.${status}`) }),
      );
    },
    [mutate, t],
  );

  const setCampaignStatus = useCallback(
    (_platform: "google" | "meta", _id: string, status: AdStatus) => {
      pushToast(t("toast.metaDemo", { status: t(`status.${status}`) }));
    },
    [pushToast, t],
  );

  const addInvoice = useCallback(
    async (input: NewInvoiceInput) => {
      await mutate(
        { op: "addInvoice", input },
        input.sendNow ? t("toast.invoiceSent") : t("toast.invoiceDraft"),
      );
    },
    [mutate, t],
  );

  const updateInvoiceStatus = useCallback(
    async (id: string, status: InvoiceStatus) => {
      await mutate(
        { op: "updateInvoiceStatus", id, status },
        t("toast.invoiceStatus", { status: t(`status.${status}`) }),
      );
    },
    [mutate, t],
  );

  const addNewsletter = useCallback(
    (_input: NewNewsletterInput) => {
      pushToast(t("toast.useNewsletter"));
    },
    [pushToast, t],
  );

  const updateNewsletterStatus = useCallback(
    (_id: string, _status: NewsletterStatus) => {
      pushToast(t("toast.newsletterFromAccount"));
    },
    [pushToast, t],
  );

  const updateInquiryStatus = useCallback(
    async (id: string, status: InquiryStatus) => {
      await mutate(
        { op: "updateInquiryStatus", id, status },
        t("toast.inquiryStatus", { status: t(`status.${status}`) }),
      );
    },
    [mutate, t],
  );

  const convertInquiryToLead = useCallback(
    async (id: string) => {
      await mutate(
        { op: "convertInquiryToLead", id },
        t("toast.inquiryConverted"),
      );
    },
    [mutate, t],
  );

  const addFollowUp = useCallback(
    async (input: NewFollowUpInput) => {
      await mutate({ op: "addFollowUp", input }, t("toast.followUpCreated"));
    },
    [mutate, t],
  );

  const updateFollowUpStatus = useCallback(
    async (id: string, status: FollowUpStatus) => {
      await mutate(
        { op: "updateFollowUpStatus", id, status },
        t("toast.followUpStatus", { status: t(`status.${status}`) }),
      );
    },
    [mutate, t],
  );

  const addSale = useCallback(
    async (input: NewSaleInput) => {
      await mutate({ op: "addSale", input }, t("toast.saleCreated"));
    },
    [mutate, t],
  );

  const updateSaleStatus = useCallback(
    async (id: string, status: SaleStatus) => {
      await mutate(
        { op: "updateSaleStatus", id, status },
        t("toast.saleStatus", { status: t(`status.${status}`) }),
      );
    },
    [mutate, t],
  );

  const resetDemo = useCallback(() => {
    pushToast(t("toast.demoResetOff"));
  }, [pushToast, t]);

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

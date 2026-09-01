"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultTemplateBoilerplate,
  getQuoteTemplateById,
  loadQuoteTemplates,
  nextQuoteTemplateId,
  persistQuoteTemplates,
  resetQuoteTemplatesToSeed,
  type OdooQuoteTemplate,
} from "@/lib/quote-templates";
import { useLocale } from "@/lib/i18n";

type QuoteTemplatesStore = {
  ready: boolean;
  templates: OdooQuoteTemplate[];
  upsertTemplate: (template: OdooQuoteTemplate) => void;
  deleteTemplate: (id: number) => void;
  resetToSeed: () => void;
};

const QuoteTemplatesContext = createContext<QuoteTemplatesStore | null>(null);

export function QuoteTemplatesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [templates, setTemplates] = useState<OdooQuoteTemplate[]>([]);

  useEffect(() => {
    setTemplates(loadQuoteTemplates());
    setReady(true);
  }, []);

  const save = useCallback((next: OdooQuoteTemplate[]) => {
    setTemplates(next);
    persistQuoteTemplates(next);
  }, []);

  const upsertTemplate = useCallback(
    (template: OdooQuoteTemplate) => {
      setTemplates((prev) => {
        const exists = prev.some((row) => row.id === template.id);
        const next = exists
          ? prev.map((row) => (row.id === template.id ? template : row))
          : [...prev, template];
        persistQuoteTemplates(next);
        return next;
      });
    },
    [],
  );

  const deleteTemplate = useCallback((id: number) => {
    setTemplates((prev) => {
      const next = prev.filter((row) => row.id !== id);
      persistQuoteTemplates(next);
      return next;
    });
  }, []);

  const resetToSeed = useCallback(() => {
    const next = resetQuoteTemplatesToSeed();
    setTemplates(next);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      templates,
      upsertTemplate,
      deleteTemplate,
      resetToSeed,
    }),
    [ready, templates, upsertTemplate, deleteTemplate, resetToSeed],
  );

  return (
    <QuoteTemplatesContext.Provider value={value}>
      {children}
    </QuoteTemplatesContext.Provider>
  );
}

export function useQuoteTemplates() {
  const ctx = useContext(QuoteTemplatesContext);
  if (!ctx) {
    throw new Error("useQuoteTemplates must be used within QuoteTemplatesProvider");
  }
  return ctx;
}

export function useNewQuoteTemplateDraft() {
  const { t } = useLocale();
  const { templates } = useQuoteTemplates();

  return useMemo((): OdooQuoteTemplate => {
    return {
      id: nextQuoteTemplateId(templates),
      name: "",
      numberOfDays: 10,
      requireSignature: true,
      requirePayment: false,
      noteHtml: "",
      lines: defaultTemplateBoilerplate(t),
    };
  }, [templates, t]);
}

export function useQuoteTemplate(id: number | null) {
  const { templates } = useQuoteTemplates();
  return useMemo(
    () => (id == null ? null : getQuoteTemplateById(templates, id)),
    [templates, id],
  );
}

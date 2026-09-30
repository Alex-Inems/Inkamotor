"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { btnPrimary, btnSecondary, inputClass, Modal } from "@/components/modal";
import { useT } from "@/lib/i18n";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use danger styling for destructive actions. */
  danger?: boolean;
};

export type PromptOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
};

type ConfirmApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type PendingPrompt = PromptOptions & {
  resolve: (value: string | null) => void;
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const confirmSeq = useRef(0);
  const promptSeq = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmSeq.current += 1;
      setPendingConfirm({ ...options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      promptSeq.current += 1;
      setPromptValue(options.defaultValue ?? "");
      setPendingPrompt({ ...options, resolve });
    });
  }, []);

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  function closeConfirm(result: boolean) {
    pendingConfirm?.resolve(result);
    setPendingConfirm(null);
  }

  function closePrompt(result: string | null) {
    pendingPrompt?.resolve(result);
    setPendingPrompt(null);
    setPromptValue("");
  }

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        onClose={() => closeConfirm(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => closeConfirm(false)}
            >
              {pendingConfirm?.cancelLabel ?? t("common.cancel")}
            </button>
            <button
              type="button"
              className={
                pendingConfirm?.danger
                  ? "inline-flex min-h-11 items-center justify-center bg-sale px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-pink-deep disabled:opacity-50"
                  : btnPrimary
              }
              onClick={() => closeConfirm(true)}
            >
              {pendingConfirm?.confirmLabel ?? t("common.confirm")}
            </button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink/90">
          {pendingConfirm?.message}
        </p>
      </Modal>

      <Modal
        open={!!pendingPrompt}
        title={pendingPrompt?.title ?? ""}
        onClose={() => closePrompt(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => closePrompt(null)}
            >
              {pendingPrompt?.cancelLabel ?? t("common.cancel")}
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => closePrompt(promptValue.trim() || null)}
            >
              {pendingPrompt?.confirmLabel ?? t("common.confirm")}
            </button>
          </div>
        }
      >
        {pendingPrompt?.message ? (
          <p className="mb-3 text-sm leading-relaxed text-ink/90">
            {pendingPrompt.message}
          </p>
        ) : null}
        <input
          className={inputClass}
          value={promptValue}
          placeholder={pendingPrompt?.placeholder}
          autoFocus
          onChange={(event) => setPromptValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              closePrompt(promptValue.trim() || null);
            }
          }}
        />
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.confirm;
}

export function usePromptDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("usePromptDialog must be used within ConfirmProvider");
  }
  return ctx.prompt;
}

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

function DialogShell({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ash/70 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative z-10 w-full max-w-[22rem] overflow-hidden rounded-2xl border border-line/80 bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:max-w-[24rem]"
      >
        {children}
      </div>
    </div>
  );
}

function WarningIcon({ danger }: { danger?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
        danger
          ? "bg-sale/15 text-pink"
          : "bg-accent/20 text-chat-out"
      }`}
    >
      {danger ? (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
      )}
    </span>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const confirmSeq = useRef(0);
  const promptSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const closeConfirm = useCallback((result: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const closePrompt = useCallback((result: string | null) => {
    setPendingPrompt((current) => {
      current?.resolve(result);
      return null;
    });
    setPromptValue("");
  }, []);

  useEffect(() => {
    if (!pendingPrompt) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [pendingPrompt]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}

      <DialogShell
        open={!!pendingConfirm}
        onClose={() => closeConfirm(false)}
        labelledBy="confirm-dialog-title"
      >
        <div className="px-5 pb-2 pt-5">
          <div className="flex items-start gap-3.5">
            <WarningIcon danger={pendingConfirm?.danger} />
            <div className="min-w-0 flex-1 pt-0.5">
              <h2
                id="confirm-dialog-title"
                className="font-display text-[1.35rem] leading-tight tracking-wide text-ink"
              >
                {pendingConfirm?.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-mute">
                {pendingConfirm?.message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-4">
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-ash/40 px-3 text-sm font-semibold text-ink transition-colors hover:bg-ash"
            onClick={() => closeConfirm(false)}
          >
            {pendingConfirm?.cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            autoFocus
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold text-white transition-colors ${
              pendingConfirm?.danger
                ? "bg-sale hover:bg-pink-deep"
                : "bg-accent hover:bg-accent-deep"
            }`}
            onClick={() => closeConfirm(true)}
          >
            {pendingConfirm?.confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </DialogShell>

      <DialogShell
        open={!!pendingPrompt}
        onClose={() => closePrompt(null)}
        labelledBy="prompt-dialog-title"
      >
        <div className="px-5 pb-2 pt-5">
          <h2
            id="prompt-dialog-title"
            className="font-display text-[1.35rem] leading-tight tracking-wide text-ink"
          >
            {pendingPrompt?.title}
          </h2>
          {pendingPrompt?.message ? (
            <p className="mt-2 text-sm leading-relaxed text-mute">
              {pendingPrompt.message}
            </p>
          ) : null}
          <input
            ref={inputRef}
            className="mt-4 w-full rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm text-ink outline-none transition-colors placeholder:text-mute/70 focus:border-gold"
            value={promptValue}
            placeholder={pendingPrompt?.placeholder}
            onChange={(event) => setPromptValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                closePrompt(promptValue.trim() || null);
              }
            }}
          />
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-4">
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-ash/40 px-3 text-sm font-semibold text-ink transition-colors hover:bg-ash"
            onClick={() => closePrompt(null)}
          >
            {pendingPrompt?.cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-deep"
            onClick={() => closePrompt(promptValue.trim() || null)}
          >
            {pendingPrompt?.confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </DialogShell>
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

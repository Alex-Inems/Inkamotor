"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ColorStripe, InkamotoLogo } from "@/components/brand";
import { LanguageSwitcher, useT } from "@/lib/i18n";

function loginError(
  t: (path: string) => string,
  code?: string,
  fallback?: string,
) {
  if (code === "google_only") return t("pages.login.googleOnly");
  if (code === "short_password") return t("pages.login.shortPassword");
  if (code === "need_db") return t("pages.login.needDb");
  if (code === "db_error") return t("pages.login.dbError");
  return fallback || t("pages.login.failed");
}

const fieldClass =
  "w-full bg-transparent py-3.5 pl-11 pr-3.5 text-sm text-ink outline-none placeholder:text-mute/55";

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const googleError = search.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const alert =
    error ||
    (googleError === "google_setup"
      ? t("pages.login.googleSetup")
      : googleError
        ? t("pages.login.googleFailed")
        : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setError(loginError(t, json.code, json.error));
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(
    next.startsWith("/") ? next : "/",
  )}`;

  return (
    <div className="relative min-h-svh overflow-hidden bg-canvas text-ink">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 12% 18%, color-mix(in srgb, var(--accent) 38%, transparent), transparent 58%), radial-gradient(ellipse 55% 45% at 92% 88%, color-mix(in srgb, var(--wine) 26%, transparent), transparent 55%), radial-gradient(ellipse 40% 35% at 70% 8%, color-mix(in srgb, var(--gold) 14%, transparent), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden
        style={{ backgroundImage: "url(/grain.svg)", backgroundSize: "280px" }}
      />

      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <div className="relative mx-auto flex min-h-svh w-full max-w-md items-center justify-center px-4 py-14 sm:px-6 lg:max-w-6xl lg:px-10 lg:py-16">
        <div className="login-modal-enter grid w-full overflow-hidden border border-line/80 bg-panel shadow-[0_32px_90px_rgba(0,0,0,0.55)] lg:grid-cols-[1.05fr_0.95fr]">
          <aside className="relative hidden flex-col justify-between bg-ash px-10 py-10 lg:flex">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 0% 100%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 60%)",
              }}
            />
            <div className="relative">
              <InkamotoLogo className="h-11 w-auto" />
              <p className="mt-4 font-display text-xs tracking-[0.28em] text-sand">
                {t("brand.crm")}
              </p>
            </div>
            <div className="relative max-w-sm">
              <h2 className="font-display text-5xl leading-[0.95] tracking-wide text-ink">
                {t("pages.login.welcome")}
              </h2>
              <p className="mt-5 text-base leading-relaxed text-mute">
                {t("pages.login.subtitle")}
              </p>
            </div>
            <p className="relative text-xs tracking-wide text-mute/80">
              {t("pages.login.footer")}
            </p>
            <ColorStripe className="absolute inset-x-0 bottom-0" />
          </aside>

          <div className="relative bg-panel px-5 py-8 sm:px-10 sm:py-12">
            <ColorStripe className="absolute inset-x-0 top-0 lg:hidden" />

            <div className="mb-8 text-center lg:hidden">
              <InkamotoLogo className="mx-auto h-9 w-auto" />
              <p className="mt-3 font-display text-[0.7rem] tracking-[0.22em] text-sand">
                {t("brand.crm")}
              </p>
              <h1
                id="login-title"
                className="mt-4 font-display text-3xl tracking-wide text-ink"
              >
                {t("pages.login.welcome")}
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-mute">
                {t("pages.login.subtitle")}
              </p>
            </div>

            <h1
              id="login-title-desktop"
              className="hidden font-display text-3xl tracking-wide text-ink lg:block"
            >
              {t("pages.login.signIn")}
            </h1>
            <p className="mt-2 hidden text-sm text-mute lg:block">
              {t("pages.login.firstTime")}
            </p>

            <a
              href={googleHref}
              className="mt-8 flex h-12 w-full items-center justify-center gap-3 border border-line bg-ash text-sm font-semibold text-ink transition-colors hover:border-sand hover:bg-canvas hover:text-sand"
            >
              <GoogleMark />
              {t("pages.login.continueGoogle")}
            </a>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">
                {t("pages.login.orEmail")}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
              <div className="overflow-hidden border border-line bg-ash focus-within:border-sand">
                <label className="relative block">
                  <span className="sr-only">{t("common.email")}</span>
                  <MailIcon />
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t("pages.login.emailPlaceholder")}
                    className={fieldClass}
                  />
                </label>
                <div className="h-px bg-line" />
                <label className="relative block">
                  <span className="sr-only">{t("pages.login.password")}</span>
                  <LockIcon />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder={t("pages.login.passwordPlaceholder")}
                    className={`${fieldClass} pr-16`}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute hover:text-sand"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword
                        ? t("pages.login.hidePassword")
                        : t("pages.login.showPassword")
                    }
                  >
                    {showPassword ? t("pages.login.hide") : t("pages.login.show")}
                  </button>
                </label>
              </div>

              {alert ? (
                <p
                  role="alert"
                  className="border border-wine/40 bg-wine/10 px-3 py-2.5 text-sm leading-relaxed text-pink"
                >
                  {alert}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-mute lg:hidden">
                  {t("pages.login.firstTime")}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex h-12 w-full items-center justify-center bg-accent text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? t("pages.login.signingIn") : t("pages.login.signIn")}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-mute lg:hidden">
              {t("pages.login.footer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M4 7l8 7 8-7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 32.4 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.9 19.6C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-4.1 5.5-7.3 6.5l6.2 5.2C37.5 37.3 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function LoginLoading() {
  const t = useT();
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas text-mute">
      {t("common.loading")}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}

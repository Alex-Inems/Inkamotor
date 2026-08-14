"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ColorStripe, InkamotoLogo } from "@/components/brand";
import { CRM_LOGIN_EMAIL } from "@/lib/auth-public";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";
  const [email] = useState(CRM_LOGIN_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Login failed");
        return;
      }
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-ash px-4 py-10 text-ink">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, color-mix(in srgb, var(--wine) 28%, transparent), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 80%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage: "url(/grain.svg)",
          backgroundSize: "280px",
        }}
      />

      <div
        role="dialog"
        aria-labelledby="login-title"
        className="login-modal-enter relative w-full max-w-[26rem] border border-line bg-panel/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm"
      >
        <ColorStripe className="absolute inset-x-0 top-0" />

        <div className="px-6 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
          <div className="flex flex-col items-center text-center">
            <InkamotoLogo className="h-9 w-auto" />
            <p className="mt-3 font-display text-[0.7rem] tracking-[0.22em] text-mute">
              CRM
            </p>
            <h1
              id="login-title"
              className="mt-4 font-display text-3xl tracking-wide text-ink"
            >
              Welcome back
            </h1>
            <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-mute">
              Sign in to the Inkamoto Tours workspace.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <label className="block text-left text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                Email
              </span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                readOnly
                value={email}
                className="w-full border border-line bg-ash/80 px-3.5 py-3 text-sm text-sand outline-none"
              />
            </label>

            <label className="block text-left text-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  autoFocus
                  className="w-full border border-line bg-ash px-3.5 py-3 pr-12 text-sm text-ink outline-none transition-colors focus:border-sand"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold uppercase tracking-wide text-mute hover:text-sand"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error ? (
              <p
                role="alert"
                className="border border-wine/40 bg-wine/10 px-3 py-2.5 text-sm text-pink"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || !password}
              className="mt-1 w-full bg-accent px-4 py-3.5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-mute">
            inkamototours.com · private workspace
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-ash text-mute">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

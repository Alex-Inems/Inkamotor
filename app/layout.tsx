import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inria_Sans, Roboto, Staatliches } from "next/font/google";
import { CrmShell } from "@/components/crm-shell";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";
import {
  localeFromCookieValue,
  localeMeta,
  localeStorageKey,
} from "@/lib/i18n/config";
import { userFromClaims } from "@/lib/session";
import "./globals.css";

const staatliches = Staatliches({
  variable: "--font-staatliches",
  subsets: ["latin"],
  weight: "400",
});

const inriaSans = Inria_Sans({
  variable: "--font-inria",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Inkamoto CRM — inkamototours.com",
  description:
    "CRM for Inkamoto Tours — leads, ads, invoices, analytics, and newsletters.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c1b19",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const claims = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  const user = userFromClaims(claims);
  const locale = localeFromCookieValue(jar.get(localeStorageKey)?.value);

  return (
    <html
      lang={localeMeta[locale].bcp47}
      suppressHydrationWarning
      className={`${staatliches.variable} ${inriaSans.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <CrmShell user={user} locale={locale}>
          {children}
        </CrmShell>
      </body>
    </html>
  );
}

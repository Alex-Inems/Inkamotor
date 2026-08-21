import type { Metadata, Viewport } from "next";
import { Inria_Sans, Roboto, Staatliches } from "next/font/google";
import { CrmShell } from "@/components/crm-shell";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c1b19",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${staatliches.variable} ${inriaSans.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <CrmShell>{children}</CrmShell>
      </body>
    </html>
  );
}

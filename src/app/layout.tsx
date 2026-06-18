import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "My Career Journey — plan your path after school!",
  description:
    "Answer a few questions and get a step-by-step plan towards the career you want: colleges, exams, costs and timelines.",
};

// Mobile-first: lock the viewport to device width so layouts scale on phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the persisted locale on the server so the first paint is already in
  // the right language (no flash). `cookies()` is async in this Next version.
  const cookieStore = await cookies();
  const initialLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={initialLocale} className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        <I18nProvider initialLocale={initialLocale}>
          {/* Column layout so the footer sticks to the bottom on short pages. */}
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

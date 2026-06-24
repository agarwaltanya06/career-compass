import type { Metadata, Viewport } from "next";
import { Nunito, Baloo_2, Mukta } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Body face: soft, rounded, highly readable. Self-hosted by next/font.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

// Heading face: warm, rounded display. Devanagari subset keeps Hindi on-brand.
const baloo = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

// Devanagari body face: Nunito has no Devanagari glyphs, so Hindi body text used
// to fall back to a plain system font. Mukta is soft and rounded — it matches
// the friendly vibe and is picked up per-glyph for Devanagari (see globals.css).
const mukta = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mukta",
  display: "swap",
});

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
    <html
      lang={initialLocale}
      className={`${nunito.variable} ${baloo.variable} ${mukta.variable} h-full`}
    >
      <body className="min-h-full bg-orange-50 text-stone-900 antialiased">
        <I18nProvider initialLocale={initialLocale}>
          {/* Column layout so the footer sticks to the bottom on short pages.
              Header/footer are dropped from print (Save-as-PDF) so the exported
              plan is just the content. */}
          <div className="flex min-h-screen flex-col">
            <div className="print:hidden">
              <Header />
            </div>
            <main className="flex-1">{children}</main>
            <div className="print:hidden">
              <Footer />
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

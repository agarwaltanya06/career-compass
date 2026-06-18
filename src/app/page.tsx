"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Landing page: a clear value prop and the two primary entry points. */
export default function Home() {
  const { t } = useI18n();

  const features = [
    { title: t("home.feature1Title"), body: t("home.feature1Body"), icon: "🗺️" },
    { title: t("home.feature2Title"), body: t("home.feature2Body"), icon: "💸" },
    { title: t("home.feature3Title"), body: t("home.feature3Body"), icon: "✅" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Hero */}
      <section className="text-center sm:py-8">
        <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          {t("home.heroTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          {t("home.heroSubtitle")}
        </p>

        {/* Large, full-width tap targets on mobile; inline on larger screens. */}
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/intake"
            className="flex min-h-12 items-center justify-center rounded-xl bg-sky-600 px-6 text-base font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            {t("home.ctaStart")}
          </Link>
          <Link
            href="/journey"
            className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 hover:bg-slate-100"
          >
            {t("home.ctaSample")}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mt-14">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("home.featuresTitle")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div aria-hidden className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DIY / no-login backstop */}
      <section className="mt-12 rounded-2xl bg-sky-50 p-6 text-center">
        <h2 className="text-xl font-bold text-slate-900">
          {t("home.exploreTitle")}
        </h2>
        <p className="mt-1 text-slate-600">{t("home.exploreBody")}</p>
        <Link
          href="/plan-it-yourself"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-300 bg-white px-5 font-semibold text-sky-700 hover:bg-sky-100"
        >
          {t("nav.planItYourself")}
        </Link>
      </section>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
        {t("home.disclaimer")}
      </p>
    </div>
  );
}

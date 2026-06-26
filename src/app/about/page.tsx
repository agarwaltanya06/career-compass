"use client";

/**
 * About page: the story behind the site, in the author's own words, plus a
 * LinkedIn link. Prose-only — all copy routes through i18n (about.*) so it
 * switches with the rest of the site.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";

const LINKEDIN_URL = "https://www.linkedin.com/in/06-tanya-agarwal/";

export default function AboutPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-center text-3xl font-extrabold text-stone-900">{t("about.title")}</h1>

      <div className="mt-6 space-y-5 text-lg leading-relaxed text-stone-700">
        <p>{t("about.p1")}</p>
        <p>{t("about.p2")}</p>
        <p>{t("about.p3")}</p>
        <p>{t("about.p4")}</p>
      </div>

      <a
        href={LINKEDIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-5 font-semibold text-stone-800 transition-colors hover:bg-stone-50"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-[#0A66C2]"
        >
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
        </svg>
        {t("about.linkedin")}
      </a>
    </div>
  );
}

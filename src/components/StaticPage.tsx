"use client";

/**
 * Shared shell for the simple static content pages (§6). Each page passes an
 * i18n key prefix (e.g. "static.cvTemplates"); the shell reads title, intro,
 * and a bulleted `items` list from the message files. Placeholder content for
 * now — real content drops in by editing the message files only.
 */

import { useI18n } from "@/lib/i18n/I18nProvider";

export default function StaticPage({ prefix }: { prefix: string }) {
  const { t, tList } = useI18n();
  const items = tList(`${prefix}.items`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">{t(`${prefix}.title`)}</h1>
      <p className="mt-3 text-lg text-slate-600">{t(`${prefix}.intro`)}</p>

      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm"
          >
            {item}
          </li>
        ))}
      </ul>

      {/* Honest placeholder note while real content is still being written. */}
      <p className="mt-8 rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
        {t("common.comingSoonNote")}
      </p>
    </div>
  );
}

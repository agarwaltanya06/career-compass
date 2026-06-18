"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Footer with the standing verify-first reminder + the DIY equity backstop. */
export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("footer.rights")}</p>
        <Link href="/plan-it-yourself" className="font-medium text-sky-700 underline">
          {t("footer.diy")}
        </Link>
      </div>
    </footer>
  );
}

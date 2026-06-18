"use client";

/**
 * Site header: brand, primary navigation, and the language switcher.
 * Mobile-first — the nav collapses behind a menu button on small screens and
 * expands inline on larger ones. All tap targets are >= 44px tall.
 */

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LanguageSwitcher from "./LanguageSwitcher";

/** Nav items are data so they're easy to reorder/extend. */
const NAV_ITEMS: { href: string; labelKey: string }[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/cv-templates", labelKey: "nav.cvTemplates" },
  { href: "/free-resources", labelKey: "nav.freeResources" },
  { href: "/interview-prep", labelKey: "nav.interviewPrep" },
  { href: "/find-jobs", labelKey: "nav.findJobs" },
  { href: "/plan-it-yourself", labelKey: "nav.planItYourself" },
];

export default function Header() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-sky-700"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden className="text-2xl">🧭</span>
          {t("brand.name")}
        </Link>

        {/* Inline nav on >= md screens */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {/* Menu toggle on < md screens */}
          <button
            type="button"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 md:hidden"
          >
            <span aria-hidden className="text-xl">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Collapsible nav on < md screens */}
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 md:hidden">
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-100"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

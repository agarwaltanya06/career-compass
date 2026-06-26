"use client";

/**
 * Site header: brand, primary navigation, and the language switcher.
 * Mobile-first — the nav collapses behind a menu button on small screens and
 * expands inline on larger ones. All tap targets are >= 44px tall.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LanguageSwitcher from "./LanguageSwitcher";

/** A leaf nav link, or a parent with a dropdown of child links. */
type NavItem = {
  href?: string;
  labelKey: string;
  children?: { href: string; labelKey: string }[];
};

/** Nav items are data so they're easy to reorder/extend. */
const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  {
    labelKey: "nav.careerJourneys",
    children: [
      { href: "/intake", labelKey: "nav.startJourney" },
      // The pinned, verified sample (Engineer, Class 10) — same fixed plan the
      // home page links to, never a random/latest-cached one.
      { href: "/journey/engineer_cbse_none_class10", labelKey: "nav.sampleJourney" },
    ],
  },
  { href: "/free-resources", labelKey: "nav.freeResources" },
  { href: "/find-jobs", labelKey: "nav.findJobs" },
  { href: "/cv-templates", labelKey: "nav.cvTemplates" },
  { href: "/interview-prep", labelKey: "nav.interviewPrep" },
  { href: "/plan-it-yourself", labelKey: "nav.planItYourself" },
];

const NAV_LINK_CLASS =
  "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100";

export default function Header() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-orange-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          // sm:whitespace-nowrap keeps "My Career Journey" on one line from the
          // small breakpoint up (so it never wraps on desktop/tablet beside the
          // nav), while still allowing a wrap on very narrow phones if needed.
          className="flex items-center gap-2 text-lg font-bold text-orange-700 sm:whitespace-nowrap"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden className="text-2xl">🧭</span>
          {t("brand.name")}
        </Link>

        {/* Inline nav only on >= lg screens — the seven tabs need the room, so
            below lg we fall back to the hamburger rather than cramming/wrapping. */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <NavDropdown key={item.labelKey} item={item} />
            ) : (
              <Link key={item.href} href={item.href!} className={NAV_LINK_CLASS}>
                {t(item.labelKey)}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {/* Menu toggle on < md screens */}
          <button
            type="button"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-300 text-stone-700 lg:hidden"
          >
            <span aria-hidden className="text-xl">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Collapsible nav on < md screens */}
      {open && (
        <nav className="border-t border-stone-200 bg-orange-50 px-4 py-2 lg:hidden">
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <li key={item.labelKey}>
                  <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {t(item.labelKey)}
                  </p>
                  <ul className="flex flex-col">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-lg px-5 py-3 text-base font-medium text-stone-700 hover:bg-stone-100"
                        >
                          {t(child.labelKey)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.href}>
                  <Link
                    href={item.href!}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-stone-700 hover:bg-stone-100"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

/** A click-to-open dropdown for a parent nav item (desktop). Closes on outside
 *  click, on Escape, and after a child link is followed. */
function NavDropdown({ item }: { item: NavItem }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 ${NAV_LINK_CLASS}`}
      >
        {t(item.labelKey)}
        <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-52 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {item.children!.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              {t(child.labelKey)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

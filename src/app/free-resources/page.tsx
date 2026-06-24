"use client";

/**
 * Free Resources (§6). A fully static, mobile-friendly directory of free
 * learning links (from free-resources.md). Each resource carries need-tags;
 * tapping a tag-filter button narrows the list to one need (e.g. "Board exams").
 * Filtering is pure client state — no API calls. Links open in a new tab.
 *
 * The title/intro, tag labels and tip route through i18n for later Hindi; the
 * resource links live in lib/freeResourcesContent.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { localize } from "@/lib/i18n/localized";
import ExternalLink from "@/components/ExternalLink";
import {
  RESOURCES,
  RESOURCE_TAGS,
  type ResourceTag,
} from "@/lib/freeResourcesContent";

const PREFIX = "static.freeResources";

export default function FreeResourcesPage() {
  const { t, locale } = useI18n();
  // null = "All". Single active filter keeps the UI simple and obvious.
  const [active, setActive] = useState<ResourceTag | null>(null);

  const visible = useMemo(
    () => (active ? RESOURCES.filter((r) => r.tags.includes(active)) : RESOURCES),
    [active],
  );

  const tagLabel = (tag: ResourceTag) => t(`${PREFIX}.tags.${tag}`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-stone-900">{t(`${PREFIX}.title`)}</h1>
      <p className="mt-3 text-lg text-stone-600">{t(`${PREFIX}.intro`)}</p>

      {/* Tag filters. "All" plus one button per need. */}
      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={t(`${PREFIX}.filterLabel`)}>
        <FilterButton active={active === null} onClick={() => setActive(null)}>
          {t(`${PREFIX}.all`)}
        </FilterButton>
        {RESOURCE_TAGS.map((tag) => (
          <FilterButton key={tag} active={active === tag} onClick={() => setActive(tag)}>
            {tagLabel(tag)}
          </FilterButton>
        ))}
      </div>

      {/* Resource list (filtered). */}
      <ul className="mt-6 space-y-3">
        {visible.map((r) => (
          <li
            key={r.url}
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <ExternalLink href={r.url} className="font-bold text-amber-800 underline underline-offset-2 hover:text-amber-900">
              {r.title}
              <span aria-hidden className="ml-1 text-amber-500">↗</span>
            </ExternalLink>
            <p className="mt-1 text-sm text-stone-600">{localize(r.desc, locale)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
                >
                  {tagLabel(tag)}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-stone-700">
        <span className="font-bold text-amber-800">{t(`${PREFIX}.tipLabel`)}:</span>{" "}
        {t(`${PREFIX}.tip`)}
      </p>
    </div>
  );
}

/** A pill-shaped filter toggle. */
function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-4 text-sm font-semibold transition-colors ${
        active
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
      }`}
    >
      {children}
    </button>
  );
}

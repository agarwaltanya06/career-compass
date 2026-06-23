"use client";

/**
 * A pre-filled prompt the user can copy and paste into Google's AI Mode (or any
 * free AI chatbot) to generate their own career plan. Shown in two places:
 *   - the generation-failed screen, when our free tier is busy (so it never
 *     dead-ends);
 *   - under a successful journey, so the student can regenerate or extend it
 *     elsewhere.
 *
 * The prompt text itself is built in code (lib/generate/externalPrompt.ts) and
 * passed in; this component owns only the read-only box, the copy affordance, and
 * the "open a free AI tool" link. Copy chrome is routed through i18n.
 */

import { useState } from "react";
import ExternalLink from "@/components/ExternalLink";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Google search with `udm=50` (AI Mode when the user has it, a plain search
 * otherwise). The prompt is URL-encoded into `q`, but a long prompt can be
 * truncated by the browser/Google — so the copy button is the primary, reliable
 * path and the hint tells users to paste rather than rely on the link.
 */
function googleSearchUrl(prompt: string): string {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(prompt)}`;
}

export default function CopyablePrompt({
  prompt,
  intro,
}: {
  /** The pre-filled prompt text to display and copy. */
  prompt: string;
  /** Already-translated one-line lead shown above the box. */
  intro?: string;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions): the text is already
      // visible and selectable in the box below, so the user can copy by hand.
      setCopied(false);
    }
  };

  return (
    <div>
      {intro && <p className="text-sm text-stone-700">{intro}</p>}
      <textarea
        readOnly
        value={prompt}
        aria-label={t("copyPrompt.aria")}
        onFocus={(e) => e.currentTarget.select()}
        rows={7}
        className="mt-2 w-full resize-y rounded-xl border border-stone-300 bg-stone-50 p-3 font-mono text-xs leading-relaxed text-stone-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          <span aria-hidden>{copied ? "✅" : "📋"}</span>
          {copied ? t("copyPrompt.copied") : t("copyPrompt.copy")}
        </button>
        <ExternalLink
          href={googleSearchUrl(prompt)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-orange-300 bg-white px-4 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50"
        >
          <span aria-hidden>↗</span>
          {t("copyPrompt.openAi")}
        </ExternalLink>
      </div>
      <p className="mt-2 text-xs text-stone-500">{t("copyPrompt.hint")}</p>
    </div>
  );
}

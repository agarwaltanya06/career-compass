/**
 * An external link that always opens in a new tab, safely. Used by the static
 * content pages (find-jobs, interview-prep) so every outbound link behaves the
 * same way. `rel="noopener noreferrer"` is required with target="_blank" to stop
 * the opened page reaching back via window.opener.
 */

import type { ReactNode } from "react";

export default function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
      }
    >
      {children}
    </a>
  );
}

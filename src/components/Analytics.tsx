/**
 * Cloudflare Web Analytics — privacy-friendly, cookieless page-view tracking.
 *
 * No cookies, no localStorage, no cross-site identifiers and no personal data,
 * so it needs no consent banner (unlike Google Analytics). It reports page
 * views, top pages (each career journey has its own /journey/[slug] path, so
 * popular careers show up automatically), and referrers (traffic sources).
 *
 * Activates only when NEXT_PUBLIC_CF_BEACON_TOKEN is set, so local dev and any
 * unconfigured deploy stay clean — there's nothing to load and no-op renders.
 * Get the token from the Cloudflare dashboard: Analytics & Logs → Web Analytics
 * → Add a site (the value inside data-cf-beacon='{"token":"..."}').
 *
 * SPA route changes (Next.js client navigations) are picked up automatically by
 * the beacon via the History API — enable "SPA tracking" once in the dashboard.
 */

import Script from "next/script";

export default function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}

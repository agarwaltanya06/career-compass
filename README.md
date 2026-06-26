This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Analytics

The site uses [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
— privacy-friendly and cookieless: no cookies, no cross-site identifiers, no
personal data, so no consent banner is required. It reports page views, top
pages (each career journey has its own `/journey/[slug]` path, so popular
careers surface automatically) and referrers (traffic sources).

To enable it, set one public env var on the deploy (and locally if you want to
test it):

```bash
NEXT_PUBLIC_CF_BEACON_TOKEN=your-beacon-token
```

Get the token from the Cloudflare dashboard under **Analytics & Logs → Web
Analytics → Add a site** (it's the value inside `data-cf-beacon='{"token":"…"}'`).
When the var is unset the analytics script is not loaded at all, so local dev
stays clean. In the Web Analytics site settings, turn on **SPA tracking** so
client-side navigations between pages are counted.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

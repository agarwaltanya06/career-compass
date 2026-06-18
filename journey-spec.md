# Career Journey — Schema & Intake Spec (v0.1)

The spine of the app. The chat **collects a profile**, the LLM **returns one `journey` object** (grounded + cited), and the UI **renders that object** as a timeline + filterable cards. This file is meant to hand to Claude Code.

---

## 1. Intake flow (adaptive)

Ask one question at a time. Branch — don't ask stream to a class-9 student. Keep every question answerable by tapping.

| # | Question | Options / type | Asked when |
|---|----------|----------------|------------|
| 1 | What class are you in? | Class 9 · 10 · 11 · 12 · Passed 12 · In college · Gap year / dropped out | Always |
| 2 | Which board? | CBSE · ICSE/ISC · State board (→ which state) · NIOS/Open · Other | Always |
| 3 | Which stream have you taken? | Science (PCM) · Science (PCB) · Science (PCMB) · Commerce + Maths · Commerce, no Maths · Arts/Humanities · Vocational · Not chosen yet | Only if class ≥ 11 |
| 4 | What do you want to become? | Common chips (Cabin crew, Fashion design, CA, Nurse, Teacher, Govt job, Engineer, Doctor…) · Type your own · **Not sure — help me explore** | Always |
| 5 | Where are you? | State (→ city) | Always (for college proximity) |
| 6 | Which language for your plan? | English · Hindi · (others) | Optional |

> **Cost is not an intake question.** Fetch *all* options across every price band, then let the user filter the rendered results by cost bucket (each `route` and `college` carries `costBand`). This avoids hiding options from a student who'd qualify for aid, and — bonus — dropping budget from the profile shrinks the cache space (fewer unique keys → more cache hits → fewer API calls).

**Branches**
- **"Not sure"** at Q4 → exploration mode: model suggests 3–5 careers that fit the profile, each with a one-line "why it fits you," then user picks one to expand into a full journey.
- **Class 9/10** → skip Q3; journey leads with "stream you should pick in 11th and why."
- **Passed 12 / gap year** → journey leads with the nearest entry exam or fallback route, not subject choices.

---

## 2. The `journey` object

```jsonc
{
  "meta": {
    "career": "Chartered Accountant",
    "careerAliases": ["CA", "सीए"],          // for search + regional matching
    "studentProfile": {
      "class": "12", "board": "CBSE", "stream": "Commerce + Maths",
      "state": "Rajasthan", "city": "Jaipur",
      "englishComfort": "okay", "language": "en"
    },
    "generatedAt": "2026-06-18",
    "confidence": "high|medium|low",          // model's own freshness rating
    "cacheKey": "ca|cbse|commerce-maths|class12|rajasthan"  // normalized; see §4
  },

  "overview": {
    "summary": "...",
    "dayInLife": "...",
    "payRange": { "entry": "...", "experienced": "...", "note": "approximate — verify" },
    "demandOutlook": "...",
    "requirements": ["..."]                   // height/vision/age etc. where relevant (e.g. cabin crew)
  },

  "routes": [
    {
      "id": "route-1",
      "name": "ICAI route after Class 12",
      "bestFor": "Commerce students who want to start right after 12th",
      "feasibility": "high",                  // relative to THIS student
      "feasibilityReason": "You're already in Commerce + Maths, the ideal start",
      "costBand": "low",
      "duration": "~4.5–5 years",

      "steps": [
        { "order": 1, "type": "education",     "title": "...", "timing": "Class 11–12", "description": "..." },
        { "order": 2, "type": "exam",          "title": "...", "timing": "after 12th",  "description": "..." },
        { "order": 3, "type": "experience",    "title": "...", "timing": "...",         "description": "..." }
      ],

      "exams": [
        {
          "name": "...",
          "purpose": "...",
          "eligibility": "...",
          "typicalWindow": "applications usually open ~<month>",  // never a hard date
          "costBand": "...",
          "officialUrl": "https://...",        // the page the student must verify
          "verified": false
        }
      ],

      "colleges": [
        {
          "name": "...",
          "type": "government|private|deemed",
          "location": "...",
          "approxAnnualFees": "...",
          "feesNote": "approximate — confirm on official site",
          "entranceRequired": "...",
          "officialUrl": "https://...",
          "verified": false
        }
      ],

      "missedDeadlineFallback": {
        "applies": true,
        "options": ["Wait a year and prep for X", "Enter via the graduation route instead", "Bridge with Y in the meantime"]
      }
    }
  ],

  "prepResources": [
    { "title": "...", "type": "video|free-course|official-guide|book", "costBand": "...", "language": "...", "url": "https://...", "verified": false }
  ],

  "groundingSources": [
    { "claim": "exam window", "url": "https://...", "fetchedAt": "2026-06-18" }
  ],

  "disclaimers": [
    "Dates, fees and eligibility change every year. Always confirm on the official links before acting."
  ]
}
```

---

## 3. Generation contract (the rule that keeps it safe)

These go in the LLM's system prompt, not just as hopes:

1. **Never state a hard deadline or exact fee as fact.** Use `typicalWindow` ("usually opens ~December") + an `officialUrl` the student verifies. Exact dates/fees only when pulled from a fresh search result, and even then rendered as "verify →".
2. **Every high-stakes field carries `verified: false` until a human checks it.** The UI shows unverified specifics with a "confirm on official site" tag.
3. **`groundingSources` is mandatory** for any exam/college/fee claim. No source → mark the field as general guidance, not specifics.
4. **Set `confidence` honestly.** Low confidence → UI leans harder on "verify before acting."
5. **Proper nouns stay untranslated** in any language (exam names, college names, "NIFT", "ICAI").
6. **Output strict JSON only**, no prose around it, so the UI can parse it directly.

---

## 4. Caching (turns the LLM into your curated library)

- `cacheKey` = normalized `career | board | stream | classBucket | state`.
- First request for a key → generate, you eyeball it, save it.
- Later identical profiles → serve the cached, human-verified journey. No API cost, higher trust.
- A "last verified" date per cached journey tells you when to re-check. Over months the cache *becomes* the verified content library — seeded by the LLM, owned by you.

---

## 5. Access tiers (cost control)

Live LLM generation is the only expensive part, so gate *who can trigger it* — not who can use the app.

| Tier | Who | Gets | LLM call? |
|------|-----|------|-----------|
| **Anonymous** | No login | Pick parameters from dropdowns → served a matching **cached** journey, + a few basic pre-built journeys | Never |
| **Registered** | Login (see note) | Full chat intake → can generate **new** combinations not yet cached | Only on a cache *miss* |
| **Everyone** | — | All static content (§6) | Never |

**The flywheel + the cost levers:**
- **Cache-first for everyone, including logged-in users.** A registered user only triggers a generation on a true cache miss; repeats are free.
- Anonymous dropdowns are **constrained to combinations that exist in the cache**, so nobody hits an empty result.
- When a registered user generates a new journey, it lands in the cache → instantly available to the free tier too. Motivated users effectively grow the free library.
- Add a simple **per-user rate limit** on generations as a backstop.

**One honest flag on login.** A login gate controls cost, but email+password signup is a real barrier for exactly this audience — shared phones, no personal email, first-time internet users. Two mitigations: (1) make the free cached tier good enough that most students never *need* to log in, and (2) if you do gate, **phone-OTP beats email/password** for this group in India. The DIY section below is also your equity backstop — it serves anyone who can't or won't sign in.

---

## 6. Static (build once, no maintenance)

Separate routes, plain content, fast + offline-friendly:
- `/cv-templates` — fill-in-the-blank CV/resume templates
- `/free-resources` — curated video/course links
- `/interview-prep` — common behavioural questions + how to answer
- `/find-jobs` — internship/job portals + step-by-step how-to
- `/plan-it-yourself` — **the teach-to-fish tier:** a blank timeline/plan template they can fill in themselves, plus a short "how to research any career on your own" guide (what to Google, how to find the official site, how to spot the real application page, how to sanity-check fees). This is what serves students with no login and no cached match.

---

## 7. End-to-end build & ship plan

Architecture in one line: **Next.js app on Vercel** — static pages + one serverless API route that makes the LLM call (so the API key never touches the browser). Build it with Claude Code, hand it this file.

**Phase 0 — Accounts & local setup (no code yet)**
- GitHub account → create an empty repo (e.g. `career-compass`).
- Install Node.js (LTS) → install Claude Code: `npm i -g @anthropic-ai/claude-code`.
- Anthropic Console account → create an API key → add a small prepaid credit (it's pay-as-you-go, no subscription). Use model `claude-haiku-4-5` — cheapest current model, plenty for structured generation.
- Vercel account (sign in with GitHub).

**Phase 1 — Scaffold (Claude Code)**
- Point Claude Code at the repo + this spec. Generate: landing page, adaptive intake UI (§1), journey-view page, and the static routes (§6).
- Encode the §2 `journey` object as a TypeScript type so the UI and endpoint share one contract.
- Stub the output first (hard-coded sample journey) so the UI is built before any API spend.

**Phase 2 — The generation endpoint (the only server part)**
- One API route, e.g. `/api/generate`: takes the profile → calls Anthropic with the §3 system prompt and the **web-search tool enabled** (for grounding) → validates the returned JSON against the type → returns it.
- API key lives in a **Vercel environment variable**, never in frontend code.
- Turn on **prompt caching** for the big system prompt → ~90% cheaper on repeated input.
- Mind the free-tier **function timeout** (tens of seconds). An LLM+search call can be slow, so stream the response or keep the prompt lean — another reason cache-first matters.

**Phase 3 — Cache (the cost lever)**
- Before calling the API, check for `cacheKey`; serve the stored journey if present.
- On a miss: generate → return to user → also write the JSON to a `journeys/` folder → you review → commit. Now it's cached for everyone.
- Start file-based in the repo (free, and Git is your audit trail). Move to a KV store (Vercel KV / Upstash / Supabase) only when miss volume is high.

**Phase 4 — Static content**
- Fill §6 routes. CV templates as downloadable files; curated links; the DIY timeline template.

**Phase 5 — Access tiers + safety rails (§5)**
- Anonymous: dropdowns constrained to cached keys + static content.
- Gate generation: start with a simple per-session/IP rate limit; add phone-OTP auth later (Supabase/Clerk free tiers) if needed.
- **Set a hard spend cap** in the Anthropic console *and* Vercel's spend management, so a surprise bill is impossible.

**Phase 6 — Ship**
- Push to GitHub → import into Vercel → auto-deploys → live on `yourname.vercel.app` (free).
- Add env vars in the Vercel dashboard.
- Custom domain when ready: Cloudflare Registrar (at-cost, ~$10/yr, renewals don't spike); `.org` suits a public-good tool. Point DNS at Vercel. Avoid dead free TLDs and first-year-trap registrars.

**Phase 7 — Iterate & localize**
- Verify/expand the cache; add Hindi via Sarvam (generate in-language, keep proper nouns); revisit auth.

**Rough cost:** hosting ₹0 on Vercel's free tier (personal/non-commercial use — fine for a free tool; if it ever monetizes, that's Vercel Pro at $20/mo or a move to Cloudflare Pages). Domain: free subdomain now, ~$10/yr later. LLM: Haiku is ~$1 per million input / $5 per million output tokens — a single journey is a few thousand tokens, so fractions of a cent, and every cache hit is free. Start with a tiny prepaid credit + a spend cap.

---

> **Note on the JSON above:** all values shown (fees, windows, route names) are **illustrative placeholders** to show the shape — they are not verified facts. The model fills and grounds them at generation time per §3.

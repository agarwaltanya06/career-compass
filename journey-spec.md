# Career Journey — Schema & Intake Spec (v0.2)

The spine of the app. The chat **collects a profile**, the LLM **returns one `journey` object** (grounded + cited), and the UI **renders that object** as a timeline + filterable cards. This file is meant to hand to Claude Code.

---

## 1. Intake flow (adaptive)

Ask one question at a time. Branch — don't ask stream to a class-9 student. Keep every question answerable by tapping.

| # | Question | Options / type | Asked when |
|---|----------|----------------|------------|
| 1 | What class are you in? | Class 9 · 10 · 11 · 12 · Passed 12 · In college · Gap year / dropped out | Always |
| 2 | Which board? | CBSE · ICSE/ISC · State board (→ which state) · NIOS/Open · Other | Always |
| 3 | Which stream have you taken? | Science (PCM) · Science (PCB) · Science (PCMB) · Commerce + Maths · Commerce, no Maths · Arts/Humanities · Vocational · Not chosen yet | Only if class ≥ 11 |
| 4 | What do you want to become? | ~20 common careers, **sorted alphabetically** (see list below) · Type your own · **Not sure — help me explore** | Always |
| 5 | Which language for your plan? | English · Hindi · (others) | Optional |

**Q4 career list** (alphabetical, so ordering is never a judgment call; "Type your own" and "Not sure" sit *outside* the alphabetical block, at the end):
Architecture · Cabin crew · Chartered Accountant (CA) · Civil services (UPSC) · Defence (NDA/forces) · Design (graphic/UX) · Doctor (MBBS) · Engineer · Fashion design · Government job (SSC/banking) · Hospitality / hotel management · ITI / polytechnic trades · Journalism / media · Law · Merchant navy · Nursing · Paramedical / allied health · Pharmacy · Teaching · Social work
*(Cabin crew is in the list but not privileged. Tune the exact 20 over time.)*

> **Cost and location are NOT intake questions — they're output filters.**
> - **Cost:** fetch options across every price band; let the user **sort by approximate fees** or filter by clearly-labelled **cost buckets** (see §2 note on labelling — always show the word "Cost", ideally with an indicative ₹ range).
> - **Location:** generate a broad, India-wide set of colleges/options, each tagged with state + city, then let the user filter by **state/city from the values actually present** in their result.
> - Bonus: dropping budget *and* location from the profile shrinks the cache space (fewer unique keys → more cache hits → fewer API calls).

**Branches**
- **"Not sure"** at Q4 → exploration mode: model suggests 3–5 careers that fit the profile, each with a one-line "why it fits you," then user picks one to expand into a full journey.
- **Class 9/10** → skip Q3; journey leads with "stream you should pick in 11th and why."
- **Passed 12 / gap year** → journey leads with the nearest entry exam or fallback route, not subject choices.

---

## 2. The `journey` object

```jsonc
{
  "meta": {
    "career": "Engineer",
    "careerAliases": ["Engineering", "इंजीनियर"],  // for search + regional matching
    "studentProfile": {
      "class": "10", "board": "CBSE", "stream": null,
      "language": "en",
      "currentDate": "2026-03-01"             // anchors the dated timeline (see §2.1 + §3)
    },
    "generatedAt": "2026-06-18",
    "confidence": "high|medium|low",          // model's own freshness rating
    "cacheKey": "engineer|cbse|none|class10"  // career|board|stream|classBucket — no location/cost/model (see §4)
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
      "name": "JEE route to a 4-year engineering degree",
      "bestFor": "Class 10 students willing to take PCM and prep for entrance exams",
      "feasibility": "high",                  // relative to THIS student
      "feasibilityReason": "You're at the ideal starting point — entering Class 11",
      "costBand": "mid",                      // UI MUST render as "Cost: Medium (≈ ₹X–Y / yr)", never a bare "mid"
      "duration": "~6 years to degree (2026 → 2032)",

      // Ordered steps = the downloadable timeline. The MODEL emits a relative
      // `offsetMonths` (months from studentProfile.currentDate); your CODE computes
      // the human `targetPeriod` from it. Never let the model do calendar math. See §2.1 + §3.
      "steps": [
        { "order": 1, "type": "education",  "title": "Take PCM in Class 11",            "offsetMonths": 3,  "targetPeriod": "Mid 2026 (computed)",  "description": "..." },
        { "order": 2, "type": "exam",        "title": "Board exams + JEE Main/Advanced + private exams (BITSAT/VITEEE)", "offsetMonths": 22, "targetPeriod": "Early 2028 (computed)", "description": "..." },
        { "order": 3, "type": "application", "title": "JoSAA / JAC / state & DU counselling",  "offsetMonths": 27, "targetPeriod": "Mid 2028 (computed)",   "description": "..." },
        { "order": 4, "type": "experience",  "title": "Summer internship (end of 3rd year)",   "offsetMonths": 63, "targetPeriod": "Mid 2031 (computed)",   "description": "...", "optional": true },
        { "order": 5, "type": "education",   "title": "Graduate with B.Tech",            "offsetMonths": 75, "targetPeriod": "Mid 2032 (computed)",   "description": "..." },
        // Post-completion FORK — alternatives the student chooses between:
        { "order": 6, "type": "exam",        "title": "GATE → M.Tech to specialise",     "offsetMonths": 70, "targetPeriod": "2031–2032 (computed)",   "description": "...", "alternativeTo": "step-6b" },
        { "order": "6b", "type": "application", "title": "Apply for engineering jobs",    "offsetMonths": 72, "targetPeriod": "Early 2032 (computed)",  "description": "...", "alternativeTo": "step-6" }
      ],

      // Skills BEYOND the degree — what to build + where to upskill (price-banded).
      "skills": {
        "coreSkills": ["...", "..."],         // e.g. problem-solving, a programming language, domain basics
        "upskilling": [
          { "name": "...", "why": "...", "costBand": "free", "url": "https://...", "verified": false }
        ]
      },

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
          "state": "...",                      // for the location filter
          "city": "...",                       // for the location filter
          "approxAnnualFees": "...",           // drives the "sort by fees" control
          "costBand": "free|low|mid|high",     // render as "Cost: …"
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

## 2.1 Timeline & downloads

The ordered `steps` (with `targetPeriod`) **are** the timeline — no separate structure needed. The journey view should render them as a dated vertical timeline, and offer **two downloads** of it:

- **`.ics` calendar file** — key milestones import straight into the phone's calendar app. Works on basic Android, no app install. (Use approximate month-level events with a clear "approximate — verify" note in each event description.)
- **PDF / printable list** — the same milestones as a plain dated list, zero-friction for anyone who finds calendar import intimidating.

This download capability applies to **every** generated journey, not just `/plan-it-yourself`. **Dates are computed in code, not by the model:** the model emits a relative `offsetMonths` per step, and your code turns that into the coarse `targetPeriod` ("Mid 2026") from the student's current date. This keeps calendar arithmetic deterministic (so even a small/cheap model is reliable here) and makes the timeline trivially re-anchorable. `targetPeriod` values are planning horizons, not commitments. Forks (`alternativeTo`) render as "either/or" branches, not parallel mandatory steps.

---

## 3. Generation contract (the rule that keeps it safe)

These go in the LLM's system prompt, not just as hopes:

1. **Never state a hard deadline or exact fee as fact.** Use `typicalWindow` ("usually opens ~December") + an `officialUrl` the student verifies. Exact dates/fees only when pulled from a fresh search result, and even then rendered as "verify →".
2. **Every high-stakes field carries `verified: false` until a human checks it.** The UI shows unverified specifics with a "confirm on official site" tag.
3. **`groundingSources` is mandatory** for any exam/college/fee claim. No source → mark the field as general guidance, not specifics.
4. **Set `confidence` honestly.** Low confidence → UI leans harder on "verify before acting."
5. **Proper nouns stay untranslated** in any language (exam names, college names, "NIFT", "ICAI").
6. **Output strict JSON only**, no prose around it, so the UI can parse it directly.
7. **Emit relative timing, not dates.** For each step output an `offsetMonths` (months from now); your code computes the displayed `targetPeriod`. The model must never output absolute dates — that's deterministic arithmetic done in code.
8. **Go beyond the degree.** Every route includes a `skills` block: core skills to build *and* price-banded `upskilling` options (free ones first). Include experience milestones — e.g. a summer-internship step around the end of 3rd year — and at least one **post-completion fork** (further study vs. work) via `alternativeTo`.
9. **Label cost as cost.** Bare bands ("low") are ambiguous. Every `costBand` must be rendered by the UI as "Cost: Low/Medium/High", ideally with an indicative ₹ range; colleges also expose `approxAnnualFees` so users can sort by price.
10. **Generate India-wide, tag by location.** Don't pre-filter by the student's state; return options across India, each `college` tagged with `state` + `city` so the UI can filter.

---

## 4. Caching (turns the LLM into your curated library)

- `cacheKey` = normalized `career | board | stream | classBucket`. No location, cost, **or model/provider** — once verified, a journey is just content, identical regardless of who generated it or on which model.
- For multilingual: include `language` in the key (or store one file per language), so English and Hindi versions of the same path cache separately.
- First request for a key → generate, you eyeball it, save it.
- Later identical profiles → serve the cached, human-verified journey. No API cost, higher trust.
- A "last verified" date per cached journey tells you when to re-check. Over months the cache *becomes* the verified content library — seeded by the LLM, owned by you.

---

## 5. Access tiers, models & cost control

Live generation is the only expensive part, so gate *who can trigger it* and *on whose budget* — not who can use the app.

| Tier | Who | Gets | Default model | Whose budget |
|------|-----|------|---------------|--------------|
| **Anonymous** | No login | Dropdowns → matching **cached** journey + static. On a cache *miss*, optionally a grounded free-tier generation **stamped "unverified — check official links"** | **Gemini free tier** (grounded) | None / free tier |
| **Registered** | Login | Full chat intake; live generation; can switch model | Gemini free; **Haiku** selectable | Yours (capped) |
| **Registered + own key** | Login + own API key | Picks any **provider + model** (Haiku/Sonnet/Opus/open) | Their choice | **Theirs** |
| **Everyone** | — | All static content (§6) | — | None |

**The model dropdown** (what you described): a model selector that defaults to **Gemini free tier** for everyone. Haiku, Sonnet, etc. are **shown but disabled** for anonymous users; logging in **enables Haiku** (on your key, rate-limited). **Sonnet/Opus stay gated behind bring-your-own-key** — they cost ~3×+ Haiku, so the expensive models run on the *user's* budget, never silently on yours.

**Model/provider design**
- Build the endpoint behind a **provider abstraction** (provider + model as config), so Gemini / Anthropic / OpenRouter / a user's key are all swappable without a rewrite.
- **Default = Gemini's free tier**, chosen because it's the one free option with **native search grounding** (most open-weights free tiers have no built-in web search, so they'd invent deadlines). Rate-limited (≈1,500 req/day at time of writing — verify current limits), so keep a paid fallback (your Haiku key) for when limits hit.
- **Haiku is sufficient** for the research + journey once dates are computed in code (§2.1) and grounding does the factual work — especially since every journey is human-verified before it's cached. **Sonnet** helps mainly on rarer careers and fallback-logic edge cases; offer it as a BYO-key upgrade, not a default.
- **Stakes-split.** Free/cheap models are fine for low-harm text (overview, "day in the life", exploration suggestions). High-stakes specifics (exams, fees, dates) must stay **grounded + verify-tagged**, or come from the human-verified cache.
- **Data minimization.** Free no-card tiers are often funded by **training on your prompts**. You're sending student profiles (including minors'). Send the *minimum* needed, never names/contact info, and check each provider's data-use policy before defaulting to it.
- **Bring-your-own-key**, honestly scoped: shifts cost off you, but (a) your core students won't have keys — it's for mentors/NGO staff/power users, and (b) **never log or expose a user's key**; encrypt at rest or keep it session-only.
- **You cannot log a user in with their Anthropic/ChatGPT subscription.** Consumer plans expose no API to spend on the user's behalf, their chat UIs can't be embedded (anti-framing headers) or read across origins, and scraping them breaks ToS. "Use your own access" = paste a developer **API key**, full stop.

**The cache flywheel + levers**
- **Cache-first for everyone**, including logged-in users — repeats are free.
- Anonymous dropdowns are **constrained to cached combinations**, so nobody hits an empty result.
- A registered user's new generation lands in the cache → instantly available to the free tier. Motivated users grow the free library.
- **Per-user rate limit** + hard spend caps as backstops.

**One honest flag on login.** A login gate controls cost, but email+password signup is a real barrier for exactly this audience — shared phones, no personal email, first-time internet users. Mitigations: (1) make the free cached tier good enough that most students never *need* to log in, and (2) prefer **phone-OTP** over email/password in India. `/plan-it-yourself` is also your equity backstop — it serves anyone who can't or won't sign in.

---

## 6. Static (build once, no maintenance)

Separate routes, plain content, fast + offline-friendly:
- `/cv-templates` — fill-in-the-blank CV/resume templates
- `/free-resources` — curated video/course links
- `/interview-prep` — common behavioural questions + how to answer
- `/find-jobs` — internship/job portals + step-by-step how-to
- `/plan-it-yourself` — **the teach-to-fish tier:** a blank timeline/plan template they can fill in themselves (offered as a **downloadable `.ics` calendar and a printable list/PDF**, same as §2.1), plus a short "how to research any career on your own" guide (what to Google, how to find the official site, how to spot the real application page, how to sanity-check fees). This is what serves students with no login and no cached match.

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

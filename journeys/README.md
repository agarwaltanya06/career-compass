# `journeys/` — the curated cache (spec §4)

This folder is the file-based journey cache that `POST /api/generate` reads and
writes. Git is the audit trail (spec §7 phase 3); move to a KV store only when
miss volume gets high.

## Two states (the trust invariant)

- **Verified defaults** live here, at the top level:
  `journeys/<career>_<board>_<stream>_<classBucket>__<lang>.json`
  (e.g. `engineer_cbse_none_class10__en.json`). These are **human-reviewed** and
  served to everyone on a cache hit, with no "unverified" stamp. The route
  **never** writes or overwrites these automatically.

- **Candidates** land in `journeys/candidates/` — fresh, unreviewed machine
  generations, each with a timestamp suffix so several can sit beside a verified
  default. This folder is your **review queue**.

## Lifecycle

1. **Cache miss** → generate → write an unverified candidate → return it to the
   requester stamped "unverified — check official links".
2. **You review a candidate** → if good, move it up to the top-level verified
   filename (dropping the timestamp). It's now the default for everyone. If not,
   delete it.

The filename mirrors `meta.cacheKey` (`career|board|stream|classBucket`) with
pipes replaced by underscores, plus a language suffix so `en`/`hi` versions of
the same path cache separately. No location, cost, or model is in the key — once
verified, a journey is just content.

> Candidate files are generated artifacts; commit a candidate only when you're
> promoting it to a verified default.

/**
 * Load `.env` then `.env.local` into process.env for standalone scripts.
 *
 * `next dev` reads these automatically; `tsx` does not. Loading `.env.local`
 * last gives it precedence (matching Next). Uses Node's built-in env-file loader
 * (Node 20.12+/24) and is a no-op when a file is missing or the API is absent —
 * import this FIRST so keys are present before anything reads process.env.
 */

import { existsSync } from "node:fs";

const proc = process as typeof process & { loadEnvFile?: (path?: string) => void };

for (const file of [".env", ".env.local"]) {
  if (existsSync(file) && typeof proc.loadEnvFile === "function") {
    try {
      proc.loadEnvFile(file);
    } catch {
      // Malformed env file — leave process.env as-is rather than crash.
    }
  }
}

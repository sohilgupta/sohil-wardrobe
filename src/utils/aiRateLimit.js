/* ─── AI Rate Limiter ────────────────────────────────────────────────────────
   Session-scoped rate limiting for Gemini API calls.
   Uses sessionStorage — resets automatically on page reload / new tab.

   Limits (configurable):
     TEXT features  — 5 calls / 60 s   (outfit gen, capsule, packing)
     PREVIEW        — 10 calls / 60 s  (image generation is separate quota)
   ─────────────────────────────────────────────────────────────────────────── */

const KEYS = {
  text:    "wdb_ai_rate_text",
  preview: "wdb_ai_rate_preview",
};

const LIMITS = {
  text:    { max: 5,  windowMs: 60_000 },
  preview: { max: 10, windowMs: 60_000 },
};

function getHistory(bucket) {
  try {
    const raw = sessionStorage.getItem(KEYS[bucket]);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setHistory(bucket, history) {
  try {
    sessionStorage.setItem(KEYS[bucket], JSON.stringify(history));
  } catch { /* unavailable — skip rate limiting */ }
}

/**
 * Check & record an AI call. Throws if rate limit exceeded.
 * @param {"text"|"preview"} [bucket="text"]
 */
export function enforceRateLimit(bucket = "text") {
  const { max, windowMs } = LIMITS[bucket] ?? LIMITS.text;
  const now = Date.now();
  const history = getHistory(bucket).filter((t) => now - t < windowMs);
  if (history.length >= max) {
    const waitSecs = Math.ceil((windowMs - (now - history[0])) / 1000);
    throw new Error(
      `AI rate limit reached (${max} calls/min). Please wait ${waitSecs}s before trying again.`
    );
  }
  history.push(now);
  setHistory(bucket, history);
}

/**
 * How many calls remain in the current window.
 * @param {"text"|"preview"} [bucket="text"]
 */
export function callsRemaining(bucket = "text") {
  const { max, windowMs } = LIMITS[bucket] ?? LIMITS.text;
  const now = Date.now();
  const recent = getHistory(bucket).filter((t) => now - t < windowMs);
  return Math.max(0, max - recent.length);
}

/**
 * Reset a bucket's history (e.g. for testing).
 * @param {"text"|"preview"} [bucket="text"]
 */
export function resetRateLimit(bucket = "text") {
  try {
    sessionStorage.removeItem(KEYS[bucket]);
  } catch { /* unavailable */ }
}

/* ─── AI Cache Utilities ──────────────────────────────────────────────────────
   Simple localStorage-based cache for AI results.
   Key: featureType + hash of input
   TTL: 7 days by default
   ─────────────────────────────────────────────────────────────────────────── */

const CACHE_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_PREFIX  = "vesti_ai_cache_";

/* ── Generate a simple non-cryptographic hash of a string ───────────────── */
export function inputHash(inputs) {
  const str = typeof inputs === "string" ? inputs : JSON.stringify(inputs);
  let hash  = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/* ── Read from cache — returns null on miss/expiry ──────────────────────── */
export function getCached({ featureType, hash }) {
  try {
    const key  = `${CACHE_PREFIX}${featureType}_${hash}`;
    const raw  = localStorage.getItem(key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/* ── Write to cache ─────────────────────────────────────────────────────── */
export function setCached({ featureType, hash, value, ttlMs = CACHE_TTL_MS }) {
  try {
    const key  = `${CACHE_PREFIX}${featureType}_${hash}`;
    const entry = { value, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota exceeded — silently skip
  }
}

/* ── Clear all AI caches (e.g. on logout) ───────────────────────────────── */
export function clearAllAICaches() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

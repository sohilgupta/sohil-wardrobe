/* ─── AI Response Cache ──────────────────────────────────────────────────────
   localStorage-based TTL cache for all Gemini API responses.

   Key format: {featureType}_{tripId}_{inputHash}

   Feature TTLs:
     outfitGeneration   — 24 h  (wardrobe/trip rarely changes intra-day)
     capsuleGeneration  — 7 d   (capsule is stable once curated)
     packingOptimization— 24 h
     outfitPreview      — handled separately by usePreview (content-hash keyed)
   ─────────────────────────────────────────────────────────────────────────── */

const CACHE_KEY = "wdb_ai_cache_v1";

const TTL_MS = {
  outfitGeneration:    24 * 60 * 60 * 1000,
  capsuleGeneration:    7 * 24 * 60 * 60 * 1000,
  packingOptimization: 24 * 60 * 60 * 1000,
};

/* ── Simple djb2-style hash ───────────────────────────────────────────────── */
export function inputHash(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/* ── localStorage helpers ────────────────────────────────────────────────── */
function load() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function save(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full — evict oldest half
    try {
      const sorted = Object.entries(cache).sort(([, a], [, b]) => (a.ts || 0) - (b.ts || 0));
      const half = Object.fromEntries(sorted.slice(Math.floor(sorted.length / 2)));
      localStorage.setItem(CACHE_KEY, JSON.stringify(half));
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Retrieve a cached value.
 * @param {{ featureType: string, tripId?: string, hash: string }} params
 * @returns {*} cached value or null
 */
export function getCached({ featureType, tripId = "trip", hash }) {
  const key = `${featureType}_${tripId}_${hash}`;
  const cache = load();
  const entry = cache[key];
  if (!entry) return null;
  const ttl = TTL_MS[featureType] ?? TTL_MS.outfitGeneration;
  if (Date.now() - entry.ts > ttl) {
    delete cache[key];
    save(cache);
    return null;
  }
  return entry.value;
}

/**
 * Store a value in the cache.
 * @param {{ featureType: string, tripId?: string, hash: string, value: * }} params
 */
export function setCached({ featureType, tripId = "trip", hash, value }) {
  const key = `${featureType}_${tripId}_${hash}`;
  const cache = load();
  cache[key] = { value, ts: Date.now() };
  save(cache);
}

/**
 * Invalidate all cached entries for a feature (e.g. after wardrobe changes).
 * @param {string} featureType
 * @param {string} [tripId]
 */
export function invalidateFeature(featureType, tripId = "trip") {
  const cache = load();
  const prefix = `${featureType}_${tripId}_`;
  let changed = false;
  Object.keys(cache).forEach((k) => {
    if (k.startsWith(prefix)) { delete cache[k]; changed = true; }
  });
  if (changed) save(cache);
}

/** Wipe the entire AI response cache. */
export function clearAllAICache() {
  localStorage.removeItem(CACHE_KEY);
}

/** Return summary stats about what's cached. */
export function getCacheStats() {
  const cache = load();
  const entries = Object.values(cache);
  const byFeature = {};
  Object.keys(cache).forEach((k) => {
    const [ft] = k.split("_");
    byFeature[ft] = (byFeature[ft] || 0) + 1;
  });
  return { total: entries.length, byFeature };
}

/* ─── AI Call Logger ─────────────────────────────────────────────────────────
   Persists a log of all Gemini API calls in localStorage.
   Used for usage monitoring and cost tracking.

   Log entry shape:
     { featureType, tripId, timestamp, promptTokens, resultTokens, tokenCount,
       cached }
   ─────────────────────────────────────────────────────────────────────────── */

const LOG_KEY  = "wdb_ai_log_v1";
const MAX_ENTRIES = 200;

/** Rough token count: ~4 chars per token (standard estimate). */
function estimateTokens(text = "") {
  return Math.ceil(text.length / 4);
}

/**
 * Record a Gemini API call (or cache hit).
 *
 * @param {{ featureType: string, tripId?: string, prompt?: string,
 *            result?: string, cached?: boolean }} params
 */
export function logAICall({ featureType, tripId = "trip", prompt = "", result = "", cached = false }) {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push({
      featureType,
      tripId,
      timestamp:    new Date().toISOString(),
      promptTokens: estimateTokens(prompt),
      resultTokens: estimateTokens(result),
      tokenCount:   estimateTokens(prompt + result),
      cached,
    });
    // Keep only the most recent entries
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
  } catch { /* storage unavailable */ }
}

/** Return the full call log. */
export function getAILog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Return aggregated usage stats. */
export function getAIStats() {
  const log = getAILog();
  const byFeature = {};
  let cachedCalls = 0;

  log.forEach(({ featureType: f, tokenCount = 0, cached }) => {
    if (!byFeature[f]) byFeature[f] = { calls: 0, cachedHits: 0, totalTokens: 0 };
    byFeature[f].calls++;
    byFeature[f].totalTokens += tokenCount;
    if (cached) { byFeature[f].cachedHits++; cachedCalls++; }
  });

  const totalTokens = log.reduce((s, e) => s + (e.tokenCount || 0), 0);
  const apiCalls    = log.filter((e) => !e.cached).length;

  // Rough cost estimate: gemini-2.5-flash ~$0.0003 / 1k tokens (blended)
  const estimatedCostUsd = (totalTokens / 1000) * 0.0003;

  return {
    totalCalls: log.length,
    apiCalls,
    cachedCalls,
    totalTokens,
    estimatedCostUsd: +estimatedCostUsd.toFixed(4),
    byFeature,
  };
}

/** Clear the call log. */
export function clearAILog() {
  localStorage.removeItem(LOG_KEY);
}

/** Return the last N entries. */
export function getRecentCalls(n = 20) {
  return getAILog().slice(-n);
}

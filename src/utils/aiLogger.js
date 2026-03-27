/* ─── AI Call Logger ──────────────────────────────────────────────────────────
   Lightweight structured logger for AI calls.
   Stores a rolling window of the last 50 calls in sessionStorage.
   ─────────────────────────────────────────────────────────────────────────── */

const LOG_KEY    = "vesti_ai_log";
const MAX_LOGS   = 50;

export function logAICall({ featureType, cached = false, prompt = "", result = "" }) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
    const entry = {
      ts:          new Date().toISOString(),
      featureType,
      cached,
      promptLen:   prompt.length,
      resultLen:   result.length,
    };
    const updated = [entry, ...existing].slice(0, MAX_LOGS);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(updated));

    if (process.env.NODE_ENV !== "production") {
      console.debug(`[Vesti AI] ${featureType}${cached ? " (cached)" : ""}`, entry);
    }
  } catch {
    // sessionStorage quota / private mode — silently ignore
  }
}

export function getAILogs() {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

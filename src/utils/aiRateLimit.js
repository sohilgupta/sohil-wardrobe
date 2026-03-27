/* ─── AI Rate Limiter ─────────────────────────────────────────────────────────
   Client-side token bucket rate limiter.
   Prevents accidental runaway AI calls in development.
   Production rate limiting should be enforced server-side.
   ─────────────────────────────────────────────────────────────────────────── */

const BUCKETS = {};

const DEFAULT_CONFIG = {
  text:  { maxTokens: 5, refillRate: 1, refillIntervalMs: 12_000 }, // 5/min
  image: { maxTokens: 2, refillRate: 1, refillIntervalMs: 30_000 }, // 2/min
};

function getBucket(type) {
  if (!BUCKETS[type]) {
    const cfg = DEFAULT_CONFIG[type] || DEFAULT_CONFIG.text;
    BUCKETS[type] = {
      tokens:     cfg.maxTokens,
      lastRefill: Date.now(),
      cfg,
    };
  }
  return BUCKETS[type];
}

/* ── Enforce rate limit — throws if bucket is empty ────────────────────── */
export function enforceRateLimit(type = "text") {
  const bucket = getBucket(type);
  const now    = Date.now();
  const elapsed = now - bucket.lastRefill;
  const refills = Math.floor(elapsed / bucket.cfg.refillIntervalMs);

  if (refills > 0) {
    bucket.tokens = Math.min(
      bucket.cfg.maxTokens,
      bucket.tokens + refills * bucket.cfg.refillRate
    );
    bucket.lastRefill = now - (elapsed % bucket.cfg.refillIntervalMs);
  }

  if (bucket.tokens <= 0) {
    const waitSec = Math.ceil(
      (bucket.cfg.refillIntervalMs - (now - bucket.lastRefill)) / 1000
    );
    throw new Error(`Rate limit hit — please wait ${waitSec}s before retrying.`);
  }

  bucket.tokens--;
}

/* ── Reset bucket (e.g. in tests) ──────────────────────────────────────── */
export function resetBucket(type = "text") {
  delete BUCKETS[type];
}

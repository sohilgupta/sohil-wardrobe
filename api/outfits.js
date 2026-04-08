/* ─── OUTFITS API — Cross-device outfit sync ─────────────────────────────────
   GET  /api/outfits?userId=<uid>  → returns saved outfits from KV store
   POST /api/outfits               → saves outfits to KV store
   Body: { userId, outfits }

   KV key strategy:
     Primary:  vesti_outfits_<userId>   (per-user, new)
     Fallback: wdb_outfits_v1           (legacy unscoped key, migration only)

   Returns 503 gracefully if KV is not configured; client falls back to localStorage.
   ─────────────────────────────────────────────────────────────────────────── */

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const LEGACY_KEY  = "wdb_outfits_v1";

function userKey(userId) {
  return userId ? `vesti_outfits_${userId}` : LEGACY_KEY;
}

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([["GET", key]]),
  });
  if (!res.ok) throw new Error(`KV error: ${res.status}`);
  const [entry] = await res.json();
  const val = entry?.result;
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([["SET", key, JSON.stringify(value)]]),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) {
    return res.status(503).json({ error: "Backend sync not configured", local: true });
  }

  try {
    if (req.method === "GET") {
      const userId = req.query?.userId || null;
      const key    = userKey(userId);

      let outfits = await kvGet(key);

      // One-time migration: if no user-scoped data, fall back to legacy key
      if (!outfits && userId) {
        const legacy = await kvGet(LEGACY_KEY);
        if (legacy && Object.keys(legacy).length > 0) {
          outfits = legacy;
          // Write to user-scoped key so future reads skip this
          await kvSet(key, legacy).catch(() => {});
        }
      }

      return res.json({ outfits: outfits || {} });
    }

    if (req.method === "POST") {
      const body    = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { userId, outfits } = body || {};
      if (!outfits || typeof outfits !== "object") {
        return res.status(400).json({ error: "Invalid outfits data" });
      }
      await kvSet(userKey(userId), outfits);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Storage error", message: err.message });
  }
}

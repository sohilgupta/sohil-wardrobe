/* ─── CAPSULE API — Cross-device Trip Capsule sync ────────────────────────────
   GET  /api/capsule  → returns saved capsule item IDs from KV store
   POST /api/capsule  → saves capsule item IDs to KV store

   Reuses the same KV infrastructure as /api/outfits.
   Returns 503 gracefully if KV is not configured; client falls back to localStorage.
   ─────────────────────────────────────────────────────────────────────────── */

import { requireAuth } from "../lib/auth.js";

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const CAPSULE_KEY = "wdb_capsule_v1";

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
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
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([["SET", key, JSON.stringify(value)]]),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (!KV_URL || !KV_TOKEN) {
    // Backend storage not configured — client silently falls back to localStorage
    return res.status(503).json({ error: "Backend sync not configured", local: true });
  }

  try {
    if (req.method === "GET") {
      const ids = await kvGet(CAPSULE_KEY);
      return res.json({ ids: Array.isArray(ids) ? ids : [] });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { ids } = body || {};
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "Invalid capsule data — expected { ids: string[] }" });
      }
      await kvSet(CAPSULE_KEY, ids);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Storage error", message: err.message });
  }
}
